import {DownloaderConfig, DownloadOptions, MediaInfo} from './types';
import {PlatformNotSupportedError} from './types/errors';
import pLimit from 'p-limit';
import logger from './utils/logger';
import {defaultConfig} from './config';
import {HandlerFactory} from '@/utils/handler-factory';

class MediaInfoFetcher {
    constructor(
        private handlerFactory: HandlerFactory,
        private config: DownloaderConfig
    ) {}

    async getMediaInfo(url: string, options: DownloadOptions): Promise<MediaInfo> {
        const handler = this.handlerFactory.getHandlerForUrl(url);
        if (!handler) {
            throw new PlatformNotSupportedError('The provided URL is not supported.');
        }

        const mergedOptions = this.mergeOptions(options);
        logger.info(`Fetching media info for URL: ${url} with options:`, mergedOptions);
        return await handler.getMediaInfo(url, mergedOptions, this.config);
    }

    private mergeOptions(options: DownloadOptions): Required<DownloadOptions> {
        return {
            quality: 'highest',
            downloadMedia: false,
            preferAudio: false,
            ...options,
        };
    }
}

class BatchProcessor {
    private limit: pLimit.Limit;

    constructor(
        private mediaInfoFetcher: MediaInfoFetcher,
        private concurrencyLimit: number
    ) {
        this.limit = pLimit(concurrencyLimit);
    }

    async batchGetMediaInfo(
        urls: string[],
        options: DownloadOptions
    ): Promise<MediaInfo[]> {
        const tasks = urls.map(url =>
            this.limit(async () => {
                try {
                    return await this.mediaInfoFetcher.getMediaInfo(url, options);
                } catch (error) {
                    logger.error(`Error processing URL ${url}: ${error}`);
                    return null;
                }
            })
        );

        const results = await Promise.all(tasks);
        return results.filter((result): result is MediaInfo => result !== null);
    }
}

export class Downloader {
    private mediaInfoFetcher: MediaInfoFetcher;
    private batchProcessor: BatchProcessor;

    constructor(configOverrides: Partial<DownloaderConfig> = {}) {
        const config = {...defaultConfig, ...configOverrides};
        const handlerFactory = new HandlerFactory();
        this.mediaInfoFetcher = new MediaInfoFetcher(handlerFactory, config);
        this.batchProcessor = new BatchProcessor(
            this.mediaInfoFetcher,
            config.concurrencyLimit || 5
        );

        logger.info('Downloader initialized with config:', config);
    }

    public async getMediaInfo(
        url: string,
        options: DownloadOptions = {}
    ): Promise<MediaInfo> {
        return this.mediaInfoFetcher.getMediaInfo(url, options);
    }

    public async batchGetMediaInfo(
        urls: string[],
        options: DownloadOptions = {}
    ): Promise<MediaInfo[]> {
        return this.batchProcessor.batchGetMediaInfo(urls, options);
    }
}
