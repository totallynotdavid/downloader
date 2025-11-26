import { DownloadOptions, MediaInfo, DownloaderConfig } from "@/types";
import { MediaInfoFetcher } from "@/core/media-info-fetcher";
import logger from "@/utils/logger";
import pLimit from "p-limit";

export class BatchProcessor {
  private limit: pLimit.Limit;

  constructor(
    private mediaInfoFetcher: MediaInfoFetcher,
    private config: DownloaderConfig,
  ) {
    this.limit = pLimit(config.concurrencyLimit || 5);
  }

  async batchGetMediaInfo(
    urls: string[],
    options: DownloadOptions,
  ): Promise<MediaInfo[]> {
    const tasks = urls.map((url) =>
      this.limit(async () => {
        try {
          return await this.mediaInfoFetcher.getMediaInfo(url, options);
        } catch (error) {
          logger.error(`Error processing URL ${url}: ${error}`);
          return null;
        }
      }),
    );

    const results = await Promise.all(tasks);
    return results.filter((result): result is MediaInfo => result !== null);
  }
}
