import {determineSite} from '@/utils/determineSite';
import {mapQualityToSite} from '@/utils/mapQualityToSite';
import {getDownloader} from '@/downloaders';
import {DownloaderResult, DownloaderOptions} from '@/types';

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

        const downloader = await getDownloader(site);
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
        return {urls: []};
    }
}

export default MediaDownloader;
