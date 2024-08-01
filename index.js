const ImgurDownloader = require('./hosts/imgur');
const RedditDownloader = require('./hosts/reddit');

const imgurDownloader = new ImgurDownloader();
const redditDownloader = new RedditDownloader();

async function MediaDownloader(url, specificHost = null) {
    try {
        if (specificHost) {
            return await processSpecificHost(url, specificHost);
        }

        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        if (hostname.includes('imgur.com')) {
            return await imgurDownloader.getDirectUrlsAndCount(url);
        } else if (hostname.includes('reddit.com')) {
            return await redditDownloader.getDirectUrlsAndCount(url);
        } else {
            throw new Error('Unsupported URL. Please use Imgur or Reddit URLs.');
        }
    } catch (error) {
        console.error(`Failed to process URL: ${error.message}`);
        return {urls: [], count: 0};
    }
}

async function processSpecificHost(url, host) {
    switch (host.toLowerCase()) {
        case 'imgur':
            return await imgurDownloader.getDirectUrlsAndCount(url);
        case 'reddit':
            return await redditDownloader.getDirectUrlsAndCount(url);
        default:
            throw new Error('Unsupported host. Please use "imgur" or "reddit".');
    }
}

module.exports = MediaDownloader;
