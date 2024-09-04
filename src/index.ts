import {determineSite, HostType} from '@/utils/determineSite';
import {mapQualityToSite, QualityType} from '@/utils/mapQualityToSite';
import ImgurDownloader from '@/hosts/imgur';
import RedditDownloader from '@/hosts/reddit';
import InstagramDownloader from '@/hosts/instagram';
import FacebookDownloader from '@/hosts/facebook';
import TwitterDownloader from '@/hosts/twitter';
import PinterestDownloader from '@/hosts/pinterest';
import TikTokDownloader from '@/hosts/tiktok';
import YouTubeDownloader from '@/hosts/youtube';
import {DownloaderResult, DownloaderOptions, Downloader} from '@/types';

const downloaders: Record<HostType, Downloader> = {
    imgur: new ImgurDownloader(),
    reddit: new RedditDownloader(),
    instagram: new InstagramDownloader(),
    facebook: new FacebookDownloader(),
    twitter: new TwitterDownloader(),
    pinterest: new PinterestDownloader(),
    tiktok: new TikTokDownloader(),
    youtube: new YouTubeDownloader(),
};

function sanitizeUrl(url: string): string {
    return url.trim().slice(0, 2000);
}

async function MediaDownloader(
    url: string,
    options: DownloaderOptions = {}
): Promise<DownloaderResult> {
    try {
        const sanitizedUrl = sanitizeUrl(url);
        const site = determineSite(sanitizedUrl);

        if (!site) {
            throw new Error('Unsupported URL');
        }

        const downloader = downloaders[site];
        const mappedQuality = mapQualityToSite(options.quality || 'highest', site);

        const result = await downloader.getDirectUrls(sanitizedUrl, {
            ...options,
            quality: mappedQuality,
        });

        if (options.includeMetadata) {
            const metadata = await downloader.getMetadata(sanitizedUrl);
            return {...result, metadata};
        }

        return result;
    } catch (error) {
        console.error(`Failed to process URL: ${(error as Error).message}`);
        return {urls: [], count: 0};
    }
}

export default MediaDownloader;
