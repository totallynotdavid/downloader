# @totallynodavid/downloader

[![npm version](https://img.shields.io/npm/v/@totallynodavid/downloader.svg)](https://www.npmjs.com/package/@totallynodavid/downloader)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

@totallynodavid/downloader is a high-performance Node.js package for backend use. It helps you get direct media URLs and metadata from various social media platforms. You'll know what to do with it. :)

## Getting Started

First, install the package:

```bash
npm install @totallynodavid/downloader
# or
yarn add @totallynodavid/downloader
```

Then, use it in your project:

```typescript
import {MediaDownloader, DownloadOptions} from '@totallynodavid/downloader';

const downloader = new MediaDownloader();

const options: DownloadOptions = {
    quality: '720p',
};

downloader
    .getMediaInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', options)
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

## What can it do?

-   ⚡ Get direct media URLs super fast
-   🌐 Works with major platforms (Facebook, YouTube, Instagram, and more)
-   ℹ️ Gives you useful info like title, duration, and thumbnail if available
-   🔢 Can handle multiple URLs at once
-   🎛️ Lets you choose video quality (when the platform supports it)
-   📜 TypeScript support with full type definitions
-   🔌 Designed for seamless integration into backend systems

Here's what platforms we (currently) support and what you can do with them:

| Platform    | Direct URLs | Metadata | Multiple Qualities | Audio-Only |
| ----------- | ----------- | -------- | ------------------ | ---------- |
| Facebook\*  | ✅          | ✅       | ✅ (HD & SD)       | ❌         |
| Imgur       | ✅          | ✅       | ❌                 | ❌         |
| Instagram\* | ✅          | ✅       | ✅                 | ❌         |
| Pinterest\* | ✅          | ✅       | ❌                 | ❌         |
| Reddit      | ✅          | ✅       | ❌                 | ❌         |
| TikTok\*    | ✅          | ✅       | ❌                 | ❌         |
| Twitter\*   | ✅          | ✅       | ❌                 | ❌         |
| YouTube     | ✅          | ✅       | ✅                 | ✅         |

> [!NOTE]  
> For platforms marked with \*, we don't talk to them directly. Instead, we use other services to get the media URLs. You can find more details about these services in the [src/hosts](src/hosts) directory.

When you use the downloader, you'll get back an object with direct URLs and metadata. It looks something like this:

```json
{
    "urls": [
        {
            "url": "https://rr4---sn-q4flrnek.googlevideo.com/videoplayback?...",
            "quality": "720p",
            "format": "mp4",
            "size": 18.2 // Size in MB
        }
    ],
    "metadata": {
        "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
        "duration": 213, // Duration in seconds
        "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
        "platform": "youtube",
        "views": 1234567890,
        "likes": 9876543
    }
}
```

## How to use it

The main class you'll use is `MediaDownloader`. Here's how to set it up:

```typescript
constructor(config?: DownloaderConfig)
```

You can pass in some options when you create it:

| Option          | Type   | Default | What it does                                 |
| --------------- | ------ | ------- | -------------------------------------------- |
| `cacheTimeout`  | number | 3600    | How long to keep stuff in cache (in seconds) |
| `maxConcurrent` | number | 5       | How many requests to make at once            |

When you're getting media info, you can also set some options:

| Option        | Type    | Default   | What it does                         |
| ------------- | ------- | --------- | ------------------------------------ |
| `quality`     | string  | 'highest' | What quality you want (like `720p`)  |
| `preferAudio` | boolean | false     | If you want just audio when possible |

The main methods you'll use are:

-   `getMediaInfo(url: string, options?: DownloadOptions): Promise<MediaInfo>`: Get info for one URL
-   `batchGetMediaInfo(urls: string[], options?: DownloadOptions): Promise<MediaInfo[]>`: Get info for multiple URLs at once

## Advanced usage

If you want to get info for a bunch of URLs at once, you can do that too:

```typescript
const urls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.instagram.com/p/ABC123/',
    'https://twitter.com/user/status/123456789',
];

downloader
    .batchGetMediaInfo(urls, {quality: '1080p'})
    .then(results => console.log(results))
    .catch(error => console.error(error));
```

> [!WARNING]  
> Be careful with this! It's up to you to make sure you're not hitting rate limits for the platforms you're using.

## Need help?

If something's not working right or you're confused, [open an issue](https://github.com/totallynotdavid/media_downloader/issues) on the GitHub page for this package. I'll do my best to help out.

## License

This project is under the MIT License. Check out the [LICENSE](LICENSE) file for all the legal details.
