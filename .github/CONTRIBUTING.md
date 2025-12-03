# Contributing

```sh
bun install
bun test
```

## Adding an extractor

Create `src/extractors/{platform}.ts`:

```typescript
import { http_get } from "../http.ts";
import { ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const response = await http_get(url, options);
  const html = await response.text();

  // Extract media URL from response
  const media_url = /* ... */;

  if (!media_url) {
    throw new ParseError("No media found", "platform");
  }

  return {
    urls: [{ type: "video", url: media_url, filename: "platform-id.mp4" }],
    headers: {},
    meta: { title: "...", author: "...", platform: "platform" },
  };
}
```

Register in `src/router.ts`:

```typescript
import platform from "./extractors/platform.ts";

const EXTRACTORS = new Map<string, ExtractorFn>([
  ["platform.com", platform],
  ["short.link", platform],
]);
```

Add tests in `tests/extractors/{platform}.test.ts` with fixtures from
`tests/fixtures.ts`.

## Code style

Biome handles formatting. Run `bun run format` before committing.

- snake_case for variables and functions
- PascalCase for types and errors
- `.ts` extensions in imports

## API responses

Reference for third-party APIs used by extractors.

<details>
<summary>Instagram (GraphQL API)</summary>

`POST https://www.instagram.com/graphql/query`

Headers: `X-IG-App-ID`, `User-Agent` (Android Instagram app).

Body: `doc_id=8845758582119845&variables={"shortcode":"..."}`

```json
{
  "data": {
    "xdt_shortcode_media": {
      "__typename": "XDTGraphVideo",
      "id": "3579941234567890123",
      "shortcode": "DQjE79kETsb",
      "is_video": true,
      "video_url": "https://scontent.cdninstagram.com/.../video.mp4",
      "display_url": "https://scontent.cdninstagram.com/.../thumbnail.jpg",
      "edge_media_to_caption": {
        "edges": [{ "node": { "text": "Caption text here" } }]
      },
      "owner": {
        "id": "123456789",
        "username": "username",
        "full_name": "Full Name"
      },
      "edge_sidecar_to_children": {
        "edges": [
          {
            "node": {
              "__typename": "XDTGraphImage",
              "is_video": false,
              "display_url": "https://scontent.cdninstagram.com/.../image.jpg"
            }
          }
        ]
      }
    }
  }
}
```

`__typename` can be `XDTGraphImage`, `XDTGraphVideo`, or `XDTGraphSidecar`
(carousel). For carousels, media items are in `edge_sidecar_to_children.edges`.

</details>

<details>
<summary>TikTok (hydration data)</summary>

Scrapes `__UNIVERSAL_DATA_FOR_REHYDRATION__` from HTML.

```json
{
  "__DEFAULT_SCOPE__": {
    "webapp.video-detail": {
      "itemInfo": {
        "itemStruct": {
          "id": "7136124191849417985",
          "desc": "Video description",
          "author": {
            "id": "6784883493821055000",
            "uniqueId": "stayc_official",
            "nickname": "STAYC"
          },
          "video": {
            "id": "7136124191849417985",
            "playAddr": "https://v16-webapp-prime.tiktok.com/.../video.mp4",
            "downloadAddr": "https://v16-webapp-prime.tiktok.com/.../video.mp4",
            "duration": 15,
            "bitrateInfo": [
              {
                "PlayAddr": {
                  "UrlList": [
                    "https://v16-webapp-prime.tiktok.com/.../video.mp4"
                  ]
                }
              }
            ]
          },
          "imagePost": {
            "images": [
              {
                "imageURL": {
                  "urlList": ["https://p16-sign.tiktokcdn-us.com/.../image.jpg"]
                }
              }
            ]
          },
          "music": {
            "id": "7136124123456789",
            "title": "Song Title",
            "playUrl": "https://sf16-ies-music.tiktokcdn.com/.../audio.mp3"
          },
          "stats": {
            "diggCount": 123456,
            "shareCount": 7890,
            "commentCount": 1234,
            "playCount": 9876543
          }
        }
      },
      "shareMeta": {
        "desc": "Video description for sharing"
      }
    }
  }
}
```

For image carousels, `imagePost.images` contains the array. For videos,
`video.bitrateInfo[0].PlayAddr.UrlList[0]` has the best quality URL.

</details>

<details>
<summary>Twitter (vxtwitter.com)</summary>

`GET https://api.vxtwitter.com/{user}/status/{id}`

```json
{
  "tweetID": "1129038424130899969",
  "conversationID": "1129038424130899969",
  "date": "Thu May 16 14:58:31 +0000 2019",
  "date_epoch": 1558018711,
  "hashtags": ["TheIncredibles", "nosim"],
  "lang": "en",
  "likes": 4726,
  "retweets": 428,
  "replies": 26,
  "text": "Final animation on my Helen phone shots...",
  "tweetURL": "https://twitter.com/_DaveMullins/status/1129038424130899969",
  "user_name": "Dave Mullins",
  "user_screen_name": "_DaveMullins",
  "user_profile_image_url": "https://pbs.twimg.com/profile_images/.../photo.jpg",
  "possibly_sensitive": false,
  "allSameType": true,
  "hasMedia": true,
  "mediaURLs": ["https://video.twimg.com/.../video.mp4"],
  "media_extended": [
    {
      "type": "video",
      "url": "https://video.twimg.com/.../video.mp4",
      "thumbnail_url": "https://pbs.twimg.com/.../thumbnail.jpg",
      "duration_millis": 29792,
      "size": { "width": 640, "height": 480 },
      "altText": null
    }
  ],
  "qrt": null,
  "qrtURL": null
}
```

`media_extended[].type` can be `video`, `image`, or `gif`.

</details>

<details>
<summary>Reddit (JSON API)</summary>

`GET https://www.reddit.com/r/{sub}/comments/{id}.json`

Video post:

```json
[
  {
    "data": {
      "children": [
        {
          "data": {
            "id": "1drzauu",
            "title": "The Chinese Tianlong-3 Rocket...",
            "author": "Harry_the_space_man",
            "score": 67191,
            "upvote_ratio": 0.95,
            "view_count": null,
            "is_video": true,
            "is_gallery": false,
            "url": "https://v.redd.it/z8nfr7ek1p9d1",
            "media": {
              "reddit_video": {
                "fallback_url": "https://v.redd.it/.../DASH_1080.mp4?source=fallback",
                "height": 1080,
                "width": 1920,
                "duration": 61,
                "bitrate_kbps": 5000,
                "has_audio": true,
                "is_gif": false
              }
            }
          }
        }
      ]
    }
  }
]
```

Gallery post:

```json
[
  {
    "data": {
      "children": [
        {
          "data": {
            "id": "1dsdwbc",
            "title": "🐈‍⬛🥊🐈",
            "author": "Wild-Department3737",
            "score": 20122,
            "is_gallery": true,
            "is_video": false,
            "gallery_data": {
              "items": [
                { "media_id": "7a8hge8cgs9d1", "id": 478817858 },
                { "media_id": "y42eje8cgs9d1", "id": 478817859 }
              ]
            },
            "media_metadata": {
              "7a8hge8cgs9d1": {
                "status": "valid",
                "e": "Image",
                "m": "image/jpg",
                "s": {
                  "y": 2272,
                  "x": 1050,
                  "u": "https://preview.redd.it/7a8hge8cgs9d1.jpg?width=1050&format=pjpg..."
                },
                "id": "7a8hge8cgs9d1"
              }
            }
          }
        }
      ]
    }
  }
]
```

For galleries, `gallery_data.items` gives the order, `media_metadata[id].s.u`
has the full-size URL.

</details>

<details>
<summary>YouTube (innertube)</summary>

`POST https://www.youtube.com/youtubei/v1/player?key={api_key}`

Headers: `User-Agent` (Android YouTube app), `X-Youtube-Client-Name: 3`.

Body:

```json
{
  "videoId": "jNQXAC9IVRw",
  "context": {
    "client": {
      "clientName": "ANDROID",
      "clientVersion": "19.09.37",
      "androidSdkVersion": 30
    }
  }
}
```

Response (truncated, full response is ~50KB):

```json
{
  "playabilityStatus": {
    "status": "OK",
    "playableInEmbed": true
  },
  "videoDetails": {
    "videoId": "jNQXAC9IVRw",
    "title": "Me at the zoo",
    "lengthSeconds": "19",
    "channelId": "UC4QobU6STFB0P71PMvOGN5A",
    "shortDescription": "The first video on YouTube...",
    "author": "jawed",
    "viewCount": "376647387"
  },
  "streamingData": {
    "expiresInSeconds": "21540",
    "formats": [
      {
        "itag": 18,
        "url": "https://rr1---sn-...",
        "mimeType": "video/mp4; codecs=\"avc1.42001E, mp4a.40.2\"",
        "bitrate": 395987,
        "width": 320,
        "height": 240,
        "lastModified": "1715978128583520",
        "quality": "medium",
        "audioQuality": "AUDIO_QUALITY_LOW",
        "audioChannels": 1,
        "audioSampleRate": "22050"
      }
    ],
    "adaptiveFormats": [
      {
        "itag": 137,
        "url": "https://rr1---sn-...",
        "mimeType": "video/mp4; codecs=\"avc1.640028\"",
        "bitrate": 1568057,
        "width": 1920,
        "height": 1080,
        "quality": "hd1080",
        "fps": 30,
        "qualityLabel": "1080p"
      },
      {
        "itag": 140,
        "url": "https://rr1---sn-...",
        "mimeType": "audio/mp4; codecs=\"mp4a.40.2\"",
        "bitrate": 130268,
        "audioQuality": "AUDIO_QUALITY_MEDIUM",
        "audioSampleRate": "44100",
        "audioChannels": 2
      }
    ]
  }
}
```

`formats` contains combined video+audio streams. `adaptiveFormats` contains
separate video-only and audio-only streams at higher qualities. Video-only
formats have `width`/`height` but no `audioChannels`. Audio-only formats have
`audioChannels` but no `width`.

</details>

<details>
<summary>Facebook (HTML scraping)</summary>

Parses embedded JSON from HTML. No external API.

Video data is extracted from escaped JSON in the page source:

```json
{
  "video_id": "2126724314377208",
  "permalink_url": "...",
  "owner": { "name": "Username" },
  "videoDeliveryResponseFragment": {
    "videoDeliveryResponseResult": {
      "dash_manifest": "<MPD>...</MPD>"
    }
  }
}
```

The DASH manifest contains `<BaseURL>` elements with video/audio URLs at
different qualities (identified by `FBQualityLabel` attribute).

Photo data:

```json
{
  "__isNode": "Photo",
  "id": "123456789",
  "owner": { "__typename": "User", "name": "Username" },
  "image": { "uri": "https://scontent.xx.fbcdn.net/.../photo.jpg" }
}
```

</details>

<details>
<summary>Imgur (api.imgur.com)</summary>

Requires `Authorization: Client-ID {client_id}` header.

`GET https://api.imgur.com/3/image/{id}`

```json
{
  "status": 200,
  "success": true,
  "data": {
    "id": "7q4TxW7",
    "account_id": 135438859,
    "account_url": null,
    "title": null,
    "description": null,
    "type": "image/png",
    "width": 640,
    "height": 480,
    "size": 208026,
    "views": 0,
    "bandwidth": 0,
    "animated": false,
    "favorite": false,
    "in_gallery": false,
    "in_most_viral": false,
    "has_sound": false,
    "is_ad": false,
    "nsfw": null,
    "link": "https://i.imgur.com/7q4TxW7.png",
    "tags": [],
    "datetime": 1720312896,
    "mp4": "",
    "hls": ""
  }
}
```

`GET https://api.imgur.com/3/album/{id}`

```json
{
  "status": 200,
  "success": true,
  "data": {
    "id": "ouMQkN1",
    "title": "!",
    "description": "",
    "datetime": 1720312896,
    "account_url": null,
    "account_id": 135438859,
    "privacy": "private",
    "views": 41255,
    "link": "https://imgur.com/a/ouMQkN1",
    "favorite": false,
    "nsfw": null,
    "images_count": 1,
    "in_gallery": true,
    "is_album": true,
    "images": [
      {
        "id": "7q4TxW7",
        "account_id": 135438859,
        "title": null,
        "description": null,
        "type": "image/png",
        "width": 640,
        "height": 480,
        "size": 208026,
        "views": 0,
        "animated": false,
        "has_sound": false,
        "link": "https://i.imgur.com/7q4TxW7.png",
        "datetime": 1720312896,
        "mp4": "",
        "hls": ""
      }
    ]
  }
}
```

Videos have `type: "video/mp4"` and the `mp4` field contains the direct URL.
`animated: true` indicates GIFs.

</details>

<details>
<summary>Pinterest (native API)</summary>

`GET https://www.pinterest.com/resource/PinResource/get/`

Query:
`?data={"options":{"field_set_key":"unauth_react_main_pin","id":"{pin_id}"}}`

Header: `X-Pinterest-PWS-Handler: www/[username].js`

Image pin:

```json
{
  "resource_response": {
    "status": "success",
    "code": 0,
    "data": {
      "id": "805651820858880488",
      "type": "pin",
      "title": "Winter Walks",
      "grid_title": "Winter Walks",
      "description": "Digital illustration made with Clip Studio Paint...",
      "is_video": false,
      "dominant_color": "#6d737a",
      "pinner": {
        "id": "805651958248726135",
        "username": "j_a_y_h_",
        "full_name": "jay",
        "follower_count": 74140
      },
      "closeup_attribution": {
        "full_name": "jay",
        "username": "j_a_y_h_"
      },
      "images": {
        "60x60": {
          "width": 60,
          "height": 60,
          "url": "https://i.pinimg.com/60x60/..."
        },
        "236x": {
          "width": 236,
          "height": 333,
          "url": "https://i.pinimg.com/236x/..."
        },
        "474x": {
          "width": 474,
          "height": 669,
          "url": "https://i.pinimg.com/474x/..."
        },
        "736x": {
          "width": 736,
          "height": 1040,
          "url": "https://i.pinimg.com/736x/..."
        },
        "orig": {
          "width": 1241,
          "height": 1754,
          "url": "https://i.pinimg.com/originals/..."
        }
      },
      "videos": null,
      "board": {
        "id": "805651889529884194",
        "name": "Digital Illustrations",
        "url": "/j_a_y_h_/digital-illustrations/"
      },
      "aggregated_pin_data": {
        "aggregated_stats": { "saves": 1, "done": 0 }
      }
    }
  }
}
```

Video pin (story pin):

```json
{
  "resource_response": {
    "data": {
      "id": "805651820863629473",
      "is_video": false,
      "story_pin_data_id": "5308709819585183150",
      "story_pin_data": {
        "page_count": 1,
        "pages": [
          {
            "video_signature": "191c591c08fc8038c096130939bec04c",
            "video": {
              "video_list": {
                "V_720P": { "url": "https://v1.pinimg.com/.../720p.mp4" },
                "V_EXP7": { "url": "https://v1.pinimg.com/.../exp7.mp4" }
              }
            }
          }
        ]
      },
      "videos": {
        "video_list": {
          "V_720P": {
            "url": "https://v1.pinimg.com/.../720p.mp4",
            "width": 720,
            "height": 1280
          },
          "V_EXP6": { "url": "https://v1.pinimg.com/.../exp6.mp4" }
        }
      }
    }
  }
}
```

For images, use `images.orig.url`. For videos, check `videos.video_list` or
`story_pin_data.pages[].video.video_list`. Quality keys: `V_720P`, `V_EXP7`,
`V_EXP6`, `V_EXP5`, `V_EXP4` (in priority order).

</details>
