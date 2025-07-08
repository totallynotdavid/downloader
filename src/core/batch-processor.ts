import {
    DownloadOptions,
    MediaInfo,
    DownloaderConfig,
    BatchResultItem,
} from '@/types';
import {MediaInfoFetcher} from '@/core/media-info-fetcher';
import logger from '@/utils/logger';
import pLimit from 'p-limit';

export class BatchProcessor {
    private limit: pLimit.Limit;

    constructor(
        private mediaInfoFetcher: MediaInfoFetcher,
        private config: DownloaderConfig
    ) {
        this.limit = pLimit(config.concurrencyLimit || 5);
    }

    async batchGetMediaInfo(
        urls: string[],
        options: DownloadOptions
    ): Promise<BatchResultItem[]> {
        const tasks = urls.map(url =>
            this.limit(async (): Promise<BatchResultItem> => {
                try {
                    const data = await this.mediaInfoFetcher.getMediaInfo(url, options);
                    return {url, data, error: null};
                } catch (error: any) {
                    logger.error(
                        `Error processing URL ${url}: ${error.message || error}`
                    );
                    return {url, data: null, error};
                }
            })
        );

        return Promise.all(tasks);
    }
}
