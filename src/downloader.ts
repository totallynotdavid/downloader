import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from './types';
import {PlatformNotSupportedError} from './types/errors';
import pLimit from 'p-limit';
import logger from './utils/logger';
import FacebookHandler from './hosts/facebook';
import ImgurHandler from './hosts/imgur';
import InstagramHandler from './hosts/instagram';
import PinterestHandler from './hosts/pinterest';
import RedditHandler from './hosts/reddit';
import TikTokHandler from './hosts/tiktok';
import TwitterHandler from './hosts/twitter';
import YouTubeHandler from './hosts/youtube';
import {defaultConfig} from './config';

export class Downloader {
    private config: DownloaderConfig;
    private handlers: PlatformHandler[];
    private limit = pLimit(5);

    constructor(configOverrides: Partial<DownloaderConfig> = {}) {
        this.config = {...defaultConfig, ...configOverrides};

        this.handlers = [
            new YouTubeHandler(),
            new FacebookHandler(),
            new InstagramHandler(),
            new TwitterHandler(),
            new TikTokHandler(),
            new PinterestHandler(),
            new RedditHandler(),
            new ImgurHandler(),
        ];

        logger.info('Downloader initialized with config:', this.config);
    }

    /**
     * Fetch media information for a single URL.
     * @param url The media URL.
     * @param options Download options.
     * @returns MediaInfo object.
     */
    public async getMediaInfo(
        url: string,
        options: DownloadOptions = {}
    ): Promise<MediaInfo> {
        const mergedOptions: Required<DownloadOptions> = {
            quality: 'highest',
            downloadMedia: false,
            preferAudio: false,
            ...options,
        };

        const handler = this.getHandlerForUrl(url);
        if (!handler) {
            throw new PlatformNotSupportedError('The provided URL is not supported.');
        }

        logger.info(`Fetching media info for URL: ${url} with options:`, mergedOptions);

        const mediaInfo = await handler.getMediaInfo(url, mergedOptions, this.config);

        return mediaInfo;
    }

    /**
     * Fetch media information for multiple URLs concurrently.
     * @param urls Array of media URLs.
     * @param options Download options.
     * @returns Array of MediaInfo objects.
     */
    public async batchGetMediaInfo(
        urls: string[],
        options: DownloadOptions = {}
    ): Promise<MediaInfo[]> {
        const mergedOptions: Required<DownloadOptions> = {
            quality: 'highest',
            downloadMedia: false,
            preferAudio: false,
            ...options,
        };

        const tasks = urls.map(url =>
            this.limit(async () => {
                try {
                    const mediaInfo = await this.getMediaInfo(url, mergedOptions);
                    return mediaInfo;
                } catch (error) {
                    logger.error(`Error processing URL ${url}: ${error}`);
                    throw error;
                }
            })
        );

        const results: MediaInfo[] = [];

        for (const task of tasks) {
            try {
                const mediaInfo = await task;
                results.push(mediaInfo);
            } catch (error) {
                logger.error(`Failed to process a URL: ${error}`);
            }
        }

        return results;
    }

    /**
     * Determine the appropriate handler for a given URL.
     * @param url The media URL.
     * @returns A PlatformHandler instance or null if not found.
     */
    private getHandlerForUrl(url: string): PlatformHandler | null {
        for (const handler of this.handlers) {
            if (handler.isValidUrl(url)) {
                return handler;
            }
        }
        return null;
    }
}
