# Platforms

What each extractor requests and which response fields it reads. Use this when a
platform changes and an extractor breaks. For the URL forms each one accepts,
see [Using the library](./usage.md#supported-urls).

The full responses are not copied here. Each recorded response is in
`tests/cassettes/`, and the tests replay it, so it cannot drift from the code.
To read one, see [Inspect a cassette](./testing.md#inspect-a-cassette).

## Instagram

See [Instagram](./instagram.md). Source:
[`instagram.ts`](../src/extractors/instagram.ts).

## TikTok

Source: [`tiktok.ts`](../src/extractors/tiktok.ts).

- Requests `https://www.tiktok.com/embed/v2/<id>`. The id comes from a
  `/video/<id>` or `/photo/<id>` path.
- Parses the JSON in `<script id="__FRONTITY_CONNECT_STATE__">`. The post is
  `source.data["/embed/v2/<id>..."].videoData`, with `itemInfos` for the post
  and `authorInfos` for the author.
- A post with `itemInfos.video.urls[0]` is a video. Otherwise it is an image
  post. Its images are `imagePostInfo.displayImages[].urlList[0]`, `covers`, and
  any `tplv-photomode-image` URL with an `x-signature` found in the HTML. Its
  audio is `musicInfos.playUrl[0]`.
- Metadata comes from `text`, `authorInfos`, `createTime`, and the counters
  `diggCount`, `playCount`, `commentCount` and `shareCount`.
- `result.headers` is `Referer: https://www.tiktok.com/`.

## Twitter/X

Source: [`twitter.ts`](../src/extractors/twitter.ts).

- Requests `https://api.vxtwitter.com/<path of the tweet URL>`. This is the
  vxtwitter service, not Twitter.
- Reads `media_extended[]`. A `video` or `gif` entry is a video and every other
  entry is an image. A tweet with no `media_extended` throws a `ParseError`.
- Filenames are `twitter-<tweetID>-<n>.<ext>`.
- Metadata comes from `text`, `user_name`, `user_screen_name`, `likes`, `views`,
  `replies`, `retweets` and `date_epoch`.

## YouTube

Source: [`youtube.ts`](../src/extractors/youtube.ts).

The extractor sends four requests in parallel. Only the first is required.

| Request                                            | Gives                          |
| -------------------------------------------------- | ------------------------------ |
| `POST /youtubei/v1/player` as the `ANDROID` client | Streams and video details      |
| `POST /youtubei/v1/player` as the `IOS` client     | Extra streams with direct URLs |
| `POST /youtubei/v1/next` as the `TVHTML5` client   | `likes` and `comments`         |
| `GET /watch?v=<id>`                                | `timestamp` from `publishDate` |

The last three are best-effort. A failure omits their fields.

- The player requests use the public WEB innertube key that
  [`youtube.ts`](../src/extractors/youtube.ts) hardcodes.
- The `ANDROID` client returns combined video and audio streams with direct URLs
  but ciphers its adaptive streams. The `IOS` client returns adaptive streams
  with direct URLs. The extractor merges both lists.
- A `playabilityStatus` other than `OK` throws a `ParseError` with YouTube's
  reason.
- The result holds the widest combined stream when one exists. When a video-only
  stream is wider than that, it also holds that stream and the highest-bitrate
  audio-only stream.
- `meta.title` has the characters `<>:"/\|?*` removed.

## Reddit

Source: [`reddit.ts`](../src/extractors/reddit.ts).

- Requests `https://old.reddit.com/` first and keeps the `name=value` part of
  every `Set-Cookie`, which includes the anonymous `loid` cookie. It adds
  `over18=1` so age-gated subreddits answer.
- Requests the post URL with `.json` appended, sending those cookies. The post
  is `[0].data.children[0].data`.
- A gallery post reads `gallery_data.items[].media_id` for the order and
  `media_metadata[<id>].s.u` (or `.s.gif`) for each image.
- A video post reads `media.reddit_video.fallback_url`.
- Any other post uses `url_overridden_by_dest`, or `url`. A `.mp4`, `.mkv` or
  `.webm` extension makes it a video.
- `meta.likes` is `score` and `meta.views` is `view_count`. Each is set only
  when the value is a finite number.

## Facebook

Source: [`facebook.ts`](../src/extractors/facebook.ts).

- Requests the URL with browser headers and reads the page HTML. There is no
  API.
- A page that contains an escaped `video_id` is a video. The extractor reads the
  DASH manifest after `permalink_url`. Each `FBQualityLabel` has a `BaseURL`,
  and the highest numeric label wins. The audio URL is the `BaseURL` after
  `AudioChannelConfiguration`.
- Any other page is a photo. The extractor reads `"__isNode":"Photo"` for the id
  and `"image":{"uri":...}` for the file.
- The author comes from the first `actors` entry for a video and from `owner`
  for a photo. The title is the fixed text `Facebook Video` or `Facebook Photo`.
- `result.headers` is the desktop `User-Agent` the extractor used.

## Imgur

Source: [`imgur.ts`](../src/extractors/imgur.ts).

- Requests `https://api.imgur.com/3/image/<id>` or `/3/album/<id>` with a public
  `client_id` query parameter. A `gallery` or `a` path segment selects the album
  endpoint.
- The id is the last path segment without its extension. For a gallery slug with
  dashes, it is the last dash-separated part when that part has at least five
  letters or digits.
- Reads `data.images`, or `data` itself for a single image. Each item uses
  `link` and `id`. A `type` starting with `video` makes it a video.
- `meta.likes` is `ups` minus `downs`. `meta.author` is `account_url`.

## Pinterest

Source: [`pinterest.ts`](../src/extractors/pinterest.ts).

- Requests `https://www.pinterest.com/resource/PinResource/get/` with a `data`
  query of
  `{"options":{"field_set_key":"unauth_react_main_pin","id":"<pin id>"}}` and
  the header `X-Pinterest-PWS-Handler: www/[username].js`.
- The id comes from `/pin/<id>` or `/pin/<slug>--<id>`.
- Reads `resource_response.data`. For video it checks
  `story_pin_data.pages[].blocks[].video.video_list` first, then
  `videos.video_list`. It takes the first of `V_720P`, `V_EXP7`, `V_EXP6`,
  `V_EXP5` and `V_EXP4` whose URL is not an `.m3u8` playlist.
- Without video it uses `images.orig.url`, or the widest image when there is no
  `orig`.
- `meta.author` is `closeup_attribution.full_name`, then `pinner.full_name`,
  then `pinner.username`.
