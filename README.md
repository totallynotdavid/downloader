# Media Downloader

A Node.js package to easily retrieve direct media URLs and metadata from various social media platforms.

## Supported Platforms

-   Facebook
-   Imgur
-   Instagram
-   Pinterest
-   Reddit
-   TikTok
-   Twitter
-   YouTube

## Installation

```
npm install @totallynodavid/downloader
```

## Basic Usage

```javascript
const MediaDownloader = require('@totallynodavid/downloader');

MediaDownloader('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

This will return an object with the direct URL(s):

```javascript
{
    urls: ['https://youtube.com/video.mp4'];
}
```

## Advanced Usage

### Quality Selection

You can specify the desired quality across all supported platforms:

```javascript
MediaDownloader('https://www.facebook.com/example/videos/123456789', {
    quality: '720p',
})
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

### Size Limit (YouTube)

For YouTube, you can set a maximum file size:

```javascript
MediaDownloader('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
    quality: '1080p',
    maxSize: 16, // 16 MB limit
})
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

### Audio-Only (YouTube)

Extract audio from YouTube videos:

```javascript
MediaDownloader('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
    preferAudio: true,
})
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

### Include Metadata

Retrieve additional metadata about the media:

```javascript
MediaDownloader('https://www.twitter.com/user/status/123456', {
    includeMetadata: true,
})
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

This will return an object with both URLs and basic metadata:

```javascript
{
  urls: ['https://twitter.com/video.mp4'],
  metadata: {
    title: 'Tweet Title',
    url: 'https://www.twitter.com/user/status/123456'
  }
}
```

## Platform-Specific Support

| Platform  | Direct URLs | URL | Title | Multiple Qualities | Audio-Only |
| --------- | ----------- | --- | ----- | ------------------ | ---------- |
| Facebook  | ✅          | ✅  | ❌    | ✅ (HD & SD)       | ❌         |
| Imgur     | ✅          | ✅  | ✅    | ❌                 | ❌         |
| Instagram | ✅          | ✅  | ❌    | ✅                 | ❌         |
| Pinterest | ✅          | ✅  | ✅    | ❌                 | ❌         |
| Reddit    | ✅          | ✅  | ✅    | ❌                 | ❌         |
| TikTok    | ✅          | ✅  | ✅    | ❌                 | ❌         |
| Twitter   | ✅          | ✅  | ✅    | ❌                 | ❌         |
| YouTube   | ✅          | ✅  | ✅    | ✅                 | ✅         |

## Notes

-   Quality and size options are primarily supported for YouTube and partially for Facebook.
-   The package automatically determines the appropriate host based on the URL.
-   If a specified quality is unavailable, the package will fall back to the closest available quality.

## Need Help?

If you encounter any issues or have questions, please [open an issue](https://github.com/totallynotdavid/media_downloader/issues) on our GitHub repository.

Happy downloading!
