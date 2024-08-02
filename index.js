const ImgurDownloader = require('./hosts/imgur');
const RedditDownloader = require('./hosts/reddit');
const InstagramDownloader = require('./hosts/instagram');
const FacebookDownloader = require('./hosts/facebook');
const TwitterDownloader = require('./hosts/twitter');
const PinterestDownloader = require('./hosts/pinterest');
const TikTokDownloader = require('./hosts/tiktok');

const imgurDownloader = new ImgurDownloader();
const redditDownloader = new RedditDownloader();
const instagramDownloader = new InstagramDownloader();
const facebookDownloader = new FacebookDownloader();
const twitterDownloader = new TwitterDownloader();
const pinterestDownloader = new PinterestDownloader();
const tiktokDownloader = new TikTokDownloader();

const allowedHosts = {
    imgur: ['imgur.com', 'i.imgur.com'],
    reddit: ['reddit.com', 'www.reddit.com'],
    instagram: ['instagram.com', 'www.instagram.com'],
    facebook: ['facebook.com', 'www.facebook.com', 'fb.watch'],
    twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
    pinterest: ['pinterest.com', 'www.pinterest.com', 'pin.it'],
    tiktok: ['tiktok.com', 'www.tiktok.com'],
};

function isAllowedHost(hostname, service) {
    return allowedHosts[service].includes(hostname);
}

async function MediaDownloader(url, specificHost = null) {
    try {
        if (specificHost) {
            return await processSpecificHost(url, specificHost);
        }

        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        if (isAllowedHost(hostname, 'imgur')) {
            return await imgurDownloader.getDirectUrlsAndCount(url);
        } else if (isAllowedHost(hostname, 'reddit')) {
            return await redditDownloader.getDirectUrlsAndCount(url);
        } else if (isAllowedHost(hostname, 'instagram')) {
            return await instagramDownloader.getDirectUrlsAndCount(url);
        } else if (isAllowedHost(hostname, 'facebook')) {
            return await facebookDownloader.getDirectUrlsAndCount(url);
        } else if (isAllowedHost(hostname, 'twitter')) {
            return await twitterDownloader.getDirectUrlsAndCount(url);
        } else if (isAllowedHost(hostname, 'pinterest')) {
            return await pinterestDownloader.getDirectUrlsAndCount(url);
        } else if (isAllowedHost(hostname, 'tiktok')) {
            return await tiktokDownloader.getDirectUrlsAndCount(url);
        } else {
            throw new Error(
                'Unsupported URL. Please use Imgur, Reddit, Instagram, Facebook, Twitter, Pinterest, or TikTok URLs.'
            );
        }
    } catch (error) {
        console.error(`Failed to process URL: ${error.message}`);
        return {urls: [], count: 0};
    }
}

async function processSpecificHost(url, host) {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    switch (host.toLowerCase()) {
        case 'imgur':
            if (isAllowedHost(hostname, 'imgur')) {
                return await imgurDownloader.getDirectUrlsAndCount(url);
            }
            break;
        case 'reddit':
            if (isAllowedHost(hostname, 'reddit')) {
                return await redditDownloader.getDirectUrlsAndCount(url);
            }
            break;
        case 'instagram':
            if (isAllowedHost(hostname, 'instagram')) {
                return await instagramDownloader.getDirectUrlsAndCount(url);
            }
            break;
        case 'facebook':
            if (isAllowedHost(hostname, 'facebook')) {
                return await facebookDownloader.getDirectUrlsAndCount(url);
            }
            break;
        case 'twitter':
            if (isAllowedHost(hostname, 'twitter')) {
                return await twitterDownloader.getDirectUrlsAndCount(url);
            }
            break;
        case 'pinterest':
            if (isAllowedHost(hostname, 'pinterest')) {
                return await pinterestDownloader.getDirectUrlsAndCount(url);
            }
            break;
        case 'tiktok':
            if (isAllowedHost(hostname, 'tiktok')) {
                return await tiktokDownloader.getDirectUrlsAndCount(url);
            }
            break;
    }
    throw new Error(
        'Unsupported host or URL. Please use a valid URL for the specified host.'
    );
}

module.exports = MediaDownloader;
