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
<summary>Twitter (vxtwitter.com)</summary>

`GET https://api.vxtwitter.com/{user}/status/{id}`

```json
{
  "tweetID": "1129038424130899969",
  "text": "...",
  "user_name": "Dave Mullins",
  "user_screen_name": "_DaveMullins",
  "likes": 42,
  "views": 256,
  "mediaURLs": ["https://video.twimg.com/.../video.mp4"],
  "media_extended": [
    {
      "type": "video",
      "url": "https://video.twimg.com/.../video.mp4",
      "size": { "width": 1280, "height": 720 }
    }
  ]
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
    "type": "image/png",
    "link": "https://i.imgur.com/7q4TxW7.png"
  }
}
```

`GET https://api.imgur.com/3/album/{id}`

```json
{
  "data": {
    "id": "ouMQkN1",
    "title": "Album title",
    "images": [
      {
        "id": "0LG8zCM",
        "type": "image/jpeg",
        "link": "https://..."
      }
    ]
  }
}
```

Videos have `type: "video/mp4"` and `mp4` field.

</details>

<details>
<summary>Pinterest (getindevice.com)</summary>

`POST https://getindevice.com/wp-json/aio-dl/video-data/`  
Body: `url={pinterest_url}` (form-urlencoded)

```json
{
  "source": "pinterest",
  "medias": [
    {
      "url": "https://i.pinimg.com/originals/.../image.jpg",
      "extension": "jpg"
    }
  ]
}
```

</details>

<details>
<summary>YouTube (innertube)</summary>

`POST https://www.youtube.com/youtubei/v1/player?key={api_key}`  
Body: JSON with `videoId` and `context.client` (Android client)

```json
{
  "playabilityStatus": { "status": "OK" },
  "videoDetails": {
    "videoId": "jNQXAC9IVRw",
    "title": "Me at the zoo",
    "author": "jawed",
    "viewCount": "376647387"
  },
  "streamingData": {
    "formats": [
      {
        "url": "https://...",
        "mimeType": "video/mp4; codecs=\"avc1.42001E, mp4a.40.2\"",
        "width": 320,
        "audioChannels": 1
      }
    ],
    "adaptiveFormats": [
      { "url": "https://...", "mimeType": "video/mp4", "width": 1920 },
      { "url": "https://...", "mimeType": "audio/mp4", "audioChannels": 2 }
    ]
  }
}
```

`formats` has combined video+audio. `adaptiveFormats` has separate streams.

</details>
