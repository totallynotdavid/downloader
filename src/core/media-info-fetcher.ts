import {DownloaderConfig, DownloadOptions, MediaInfo} from '@/types';
import {PlatformNotSupportedError} from '@/types/errors';
import {HandlerFactory} from '@/core/handler-factory';
import {mergeOptions} from '@/core/options-merger';
import logger from '@/utils/logger';

export class MediaInfoFetcher {
    constructor(
        private handlerFactory: HandlerFactory,
        private config: DownloaderConfig
    ) {}

    async getMediaInfo(url: string, options: DownloadOptions): Promise<MediaInfo> {
        const handler = this.handlerFactory.getHandlerForUrl(url);
        if (!handler) {
            throw new PlatformNotSupportedError('The provided URL is not supported.');
        }

        const mergedOptions = mergeOptions(options);
        logger.info(`Fetching media info for URL: ${url} with options:`, mergedOptions);
        return await handler.getMediaInfo(url, mergedOptions, this.config);
    }
}
