# @totallynodavid/downloader

[![npm version](https://img.shields.io/npm/v/@totallynodavid/downloader.svg)](https://www.npmjs.com/package/@totallynodavid/downloader)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

@totallynodavid/downloader is a robust Node.js package for backend use. It helps you get direct media URLs, download media, and fetch metadata from various social media platforms. You'll not what to do with it. :)

## Getting started

First, install the package:

```bash
npm install @totallynodavid/downloader
# or
yarn add @totallynodavid/downloader
```

Then, use it in your project:

```typescript
import {Downloader, DownloadOptions} from '@totallynodavid/downloader';

const downloader = new Downloader({
    downloadDir: './media',
    proxy: 'http://your-proxy-url:port',
});

const options: DownloadOptions = {
    quality: '720p',
    downloadMedia: true,
    preferAudio: false,
};

downloader
    .getMediaInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', options)
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

## What can it do?

-   🔗 Get direct media URLs from major platforms (YouTube, Instagram, Twitter, etc.)
-   💾 Download media files directly to your server
-   ℹ️ Retrieve metadata like title, duration, and thumbnail
-   🎥 Support for multiple video qualities (when available)
-   🎵 Option for audio-only downloads (for supported platforms)
-   🔒 Proxy support for bypassing rate limits
-   📜 TypeScript support with full type definitions

Here's what platforms we (currently) support and what you can do with them:

| Platform    | Direct URLs | Metadata | Multiple Qualities | Audio-Only | Download |
| ----------- | ----------- | -------- | ------------------ | ---------- | -------- |
| YouTube     | ✅          | ✅       | ✅                 | ✅         | ✅       |
| Instagram\* | ✅          | ✅       | ✅                 | ❌         | ✅       |
| Twitter\*   | ✅          | ✅       | ❌                 | ❌         | ✅       |
| TikTok\*    | ✅          | ✅       | ❌                 | ❌         | ✅       |
| Facebook\*  | ✅          | ✅       | ✅ (HD & SD)       | ❌         | ✅       |
| Pinterest\* | ✅          | ✅       | ❌                 | ❌         | ✅       |
| Reddit      | ✅          | ✅       | ❌                 | ❌         | ✅       |
| Imgur       | ✅          | ✅       | ❌                 | ❌         | ✅       |

> [!NOTE]  
> (\*) These platforms are accessed through third-party hosts. See [src/hosts](src/hosts) for details.

## How to use it

The main class you'll use is `MediaDownloader`. Here's how to set it up:

```typescript
constructor(config?: DownloaderConfig)
```

You can pass in some options when you create it:

| Option      | Type   | Default       | Description                        |
| ----------- | ------ | ------------- | ---------------------------------- |
| downloadDir | string | './downloads' | Directory to save downloaded media |
| proxy       | string | undefined     | Proxy URL for making requests      |

When you're getting media info, you can also set some options:

| Option        | Type    | Default   | Description                             |
| ------------- | ------- | --------- | --------------------------------------- |
| quality       | string  | 'highest' | Desired quality (e.g., '720p', '1080p') |
| downloadMedia | boolean | false     | Whether to download the media file      |
| preferAudio   | boolean | false     | Prefer audio-only when available        |

The main methods you'll use are:

-   `getMediaInfo(url: string, options?: DownloadOptions): Promise<MediaInfo>`: Get info for one URL
-   `batchGetMediaInfo(urls: string[], options?: DownloadOptions): Promise<MediaInfo[]>`: Get info for multiple URLs at once

These methods will return a `MediaInfo` object:

```typescript
interface MediaInfo {
    urls: {
        url: string;
        quality: string;
        format: string;
        size: number; // in MB
    }[];
    localPath?: string; // Only if downloadMedia is true
    metadata: {
        title: string;
        author: string;
        platform: string;
        views?: number;
        likes?: number;
    };
}
```

## Advanced usage

If you want to get info for a bunch of URLs at once, you can do that too:

```typescript
const urls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.instagram.com/p/ABC123/',
    'https://twitter.com/user/status/123456789',
];

downloader
    .batchGetMediaInfo(urls, {quality: '1080p', downloadMedia: true})
    .then(results => console.log(results))
    .catch(error => console.error(error));
```

> [!WARNING]  
> Be careful with this! It's up to you to make sure you're not hitting rate limits for the platforms you're using.

## Error handling

The package throws specific errors for different scenarios:

-   `PlatformNotSupportedError`: When trying to download from an unsupported platform
-   `MediaNotFoundError`: When the requested media is not found
-   `DownloadError`: When there's an issue during the download process
-   `RateLimitError`: When a rate limit is encountered (consider using a proxy)

You should handle these errors in your code:

```typescript
downloader
    .getMediaInfo(url, options)
    .then(result => console.log(result))
    .catch(error => {
        if (error instanceof PlatformNotSupportedError) {
            console.error('This platform is not supported');
        } else if (error instanceof RateLimitError) {
            console.error('Rate limit hit. Consider using a proxy.');
        } else {
            console.error('An unexpected error occurred:', error);
        }
    });
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Need help?

If you encounter any issues or have questions, please [open an issue](https://github.com/totallynotdavid/downloader/issues) on the GitHub repository.
