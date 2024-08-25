import ImgurDownloader from '@/hosts/imgur';
import RedditDownloader from '@/hosts/reddit';
import InstagramDownloader from '@/hosts/instagram';
import FacebookDownloader from '@/hosts/facebook';
import TwitterDownloader from '@/hosts/twitter';
import PinterestDownloader from '@/hosts/pinterest';
import TikTokDownloader from '@/hosts/tiktok';
import YouTubeDownloader from '@/hosts/youtube';

interface DownloaderResult {
    urls: string[];
    count: number;
}

type HostType =
    | 'imgur'
    | 'reddit'
    | 'instagram'
    | 'facebook'
    | 'twitter'
    | 'pinterest'
    | 'tiktok'
    | 'youtube';

const downloaders: Record<
    HostType,
    InstanceType<
        | typeof ImgurDownloader
        | typeof RedditDownloader
        | typeof InstagramDownloader
        | typeof FacebookDownloader
        | typeof TwitterDownloader
        | typeof PinterestDownloader
        | typeof TikTokDownloader
        | typeof YouTubeDownloader
    >
> = {
    imgur: new ImgurDownloader(),
    reddit: new RedditDownloader(),
    instagram: new InstagramDownloader(),
    facebook: new FacebookDownloader(),
    twitter: new TwitterDownloader(),
    pinterest: new PinterestDownloader(),
    tiktok: new TikTokDownloader(),
    youtube: new YouTubeDownloader(),
};

const allowedHosts: Record<HostType, string[]> = {
    imgur: ['imgur.com', 'i.imgur.com'],
    reddit: ['reddit.com', 'www.reddit.com'],
    instagram: ['instagram.com', 'www.instagram.com'],
    facebook: ['facebook.com', 'www.facebook.com', 'fb.watch'],
    twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
    pinterest: ['pinterest.com', 'www.pinterest.com', 'pin.it'],
    tiktok: ['tiktok.com', 'www.tiktok.com'],
    youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
};

function isAllowedHost(hostname: string, service: HostType): boolean {
    return allowedHosts[service].some(
        domain =>
            hostname === domain ||
            (hostname.endsWith(`.${domain}`) &&
                hostname.lastIndexOf('.', hostname.length - domain.length - 2) === -1)
    );
}

function sanitizeUrl(url: string): string {
    return url.trim().slice(0, 2000);
}

async function MediaDownloader(
    url: string,
    specificHost?: HostType | null
): Promise<DownloaderResult> {
    try {
        const sanitizedUrl = sanitizeUrl(url);
        const urlObj = new URL(sanitizedUrl);

        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('Unsupported protocol');
        }

        if (specificHost) {
            return await processSpecificHost(sanitizedUrl, specificHost);
        }

        const hostname = urlObj.hostname.toLowerCase();

        for (const host of Object.keys(allowedHosts) as HostType[]) {
            if (isAllowedHost(hostname, host)) {
                return await downloaders[host].getDirectUrlsAndCount(sanitizedUrl);
            }
        }

        throw new Error('Unsupported URL');
    } catch (error) {
        console.error(`Failed to process URL: ${(error as Error).message}`);
        return {urls: [], count: 0};
    }
}

async function processSpecificHost(
    url: string,
    host: HostType
): Promise<DownloaderResult> {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (isAllowedHost(hostname, host)) {
        return await downloaders[host].getDirectUrlsAndCount(url);
    }

    throw new Error('Unsupported host or URL');
}

export default MediaDownloader;
