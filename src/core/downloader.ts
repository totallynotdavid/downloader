import { DownloaderConfig, DownloadOptions, MediaInfo } from "@/types";
import { defaultConfig } from "@/config";
import { HandlerFactory } from "@/core/handler-factory";
import { MediaInfoFetcher } from "@/core/media-info-fetcher";
import { BatchProcessor } from "@/core/batch-processor";
import logger from "@/utils/logger";

export class Downloader {
  private mediaInfoFetcher: MediaInfoFetcher;
  private batchProcessor: BatchProcessor;

  constructor(
    configOverrides: Partial<DownloaderConfig> = {},
    mediaInfoFetcher?: MediaInfoFetcher,
    batchProcessor?: BatchProcessor,
  ) {
    const config = { ...defaultConfig, ...configOverrides };
    logger.info("Downloader initialized with config:", config);

    const handlerFactory = new HandlerFactory(config);
    this.mediaInfoFetcher =
      mediaInfoFetcher || new MediaInfoFetcher(handlerFactory, config);
    this.batchProcessor =
      batchProcessor || new BatchProcessor(this.mediaInfoFetcher, config);
  }

  public async getMediaInfo(
    url: string,
    options: DownloadOptions = {},
  ): Promise<MediaInfo> {
    return this.mediaInfoFetcher.getMediaInfo(url, options);
  }

  public async batchGetMediaInfo(
    urls: string[],
    options: DownloadOptions = {},
  ): Promise<MediaInfo[]> {
    return this.batchProcessor.batchGetMediaInfo(urls, options);
  }
}
