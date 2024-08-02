# Media Downloader

A Node.js package to retrieve direct media URLs from Imgur, Reddit, Instagram, Facebook (video), Twitter, Pinterest, and TikTok.

## Installation

`npm i @totallynodavid/downloader`

## Usage

Basic usage:

```javascript
const MediaDownloader = require('@totallynodavid/downloader');

MediaDownloader('https://imgur.com/gallery/example')
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

Advanced usage:

```javascript
MediaDownloader(url, specificHost, quality);
```

-   `url` (string): URL of the media to process.
-   `specificHost` (string, optional): Force a specific host module. Supported for all the hosts.
-   `quality` (string, optional): Media quality. Supported for Facebook videos: 'sd', 'hd'.

The package returns a Promise that resolves to:

```json
{
    urls: string[],
    count: number
}
```

If you need help, please [open an issue](https://github.com/totallynotdavid/media_downloader/issues). Happy downloading!
