# Media Downloader

A Node.js package to retrieve direct media URLs from Imgur and Reddit.

## Installation

`npm install media_downloader`

## Usage

```javascript
const MediaDownloader = require('media_downloader');

// Basic usage
MediaDownloader('https://imgur.com/gallery/example')
    .then(result => console.log(result))
    .catch(error => console.error(error));

// Specify host
MediaDownloader('https://example.com/some-url', 'imgur')
    .then(result => console.log(result))
    .catch(error => console.error(error));
```

You can also request an specific host modules directly:

```javascript
MediaDownloader(url[, specificHost]);
```

-   `url` (string): Host to process.
-   `specificHost` (string, optional): Force using a specific host module. Currently supported: 'imgur', 'reddit'.

Returns a Promise resolving to:

```json
{
    urls: string[],  // Array of direct media URLs
    count: number    // Number of media files found
}
```

We currently support these hosts:

-   Imgur
-   Reddit
