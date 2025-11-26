import {
  DownloaderConfig,
  DownloadOptions,
  MediaInfo,
  PlatformHandler,
} from "@/types";
import { DownloadError, MediaNotFoundError } from "@/types/errors";
import { HttpClient } from "@/utils/http-client";
import { FileDownloader } from "@/utils/file-downloader";
import logger from "@/utils/logger";

export default class TikTokHandler implements PlatformHandler {
  private readonly BASE_URL = "https://www.tiktok.com";

  constructor(
    private httpClient: HttpClient,
    private fileDownloader: FileDownloader,
  ) {}

  public isValidUrl(url: string): boolean {
    return /^https?:\/\/(?:www\.)?tiktok\.com\/(?:@[\w\.-]+\/video\/(\d+))/.test(
      url,
    );
  }

  public async getMediaInfo(
    url: string,
    options: Required<DownloadOptions>,
    config: DownloaderConfig,
  ): Promise<MediaInfo> {
    logger.info(`TikTokHandler: Fetching media info for URL: ${url}`);

    try {
      const pageContent = await this.fetchPageContent(url);
      const jsonData = this.extractJsonData(pageContent);
      const { metadata, mediaUrls } = this.extractInfo(jsonData);

      const selectedQuality = this.selectQuality(mediaUrls, options.quality);

      if (options.downloadMedia && selectedQuality) {
        selectedQuality.localPath = await this.downloadMedia(
          selectedQuality,
          config.downloadDir,
          metadata.title,
        );
      }

      return {
        urls: [selectedQuality],
        metadata: {
          title: metadata.title,
          author: metadata.author,
          platform: "TikTok",
          views: metadata.views,
          likes: metadata.likes,
        },
      };
    } catch (error: any) {
      logger.error(
        `TikTokHandler: Error fetching media info: ${error.message}`,
      );
      throw new DownloadError(`Failed to fetch media info: ${error.message}`);
    }
  }

  private async fetchPageContent(url: string): Promise<string> {
    const response = await this.httpClient.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (response.status !== 200) {
      throw new Error(
        `Failed to retrieve the TikTok page. Status code: ${response.status}`,
      );
    }

    return response.data;
  }

  private extractJsonData(pageContent: string): any {
    const jsonDataMatch = pageContent.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/,
    );
    if (!jsonDataMatch) {
      throw new Error(
        "Failed to locate the embedded JSON data in the TikTok page.",
      );
    }

    try {
      return JSON.parse(jsonDataMatch[1]);
    } catch (error) {
      throw new Error("Failed to parse JSON data from the TikTok page.");
    }
  }

  private extractInfo(jsonData: any): {
    metadata: MediaInfo["metadata"];
    mediaUrls: MediaInfo["urls"];
  } {
    const videoDetail = jsonData.__DEFAULT_SCOPE__["webapp.video-detail"];
    const itemStruct = videoDetail.itemInfo.itemStruct;

    const metadata = {
      title: videoDetail.shareMeta?.desc || "TikTok Video",
      author: `${itemStruct.author?.nickname || ""} (@${itemStruct.author?.uniqueId || ""})`,
      platform: "TikTok",
      views: itemStruct.stats?.playCount,
      likes: itemStruct.stats?.diggCount,
    };

    const bitrateInfo = itemStruct.video?.bitrateInfo || [];
    if (bitrateInfo.length === 0) {
      throw new MediaNotFoundError(
        "No media found for the provided TikTok URL.",
      );
    }

    const mediaUrls = bitrateInfo.map((br: any) => ({
      url: br.PlayAddr?.UrlList[0] || "",
      quality: `${br.PlayAddr?.Width}x${br.PlayAddr?.Height}`,
      format: "mp4",
      size: 0,
    }));

    return { metadata, mediaUrls };
  }

  private selectQuality(
    mediaUrls: MediaInfo["urls"],
    requestedQuality: string,
  ): MediaInfo["urls"][0] {
    if (requestedQuality === "highest") {
      return mediaUrls.reduce((prev, current) =>
        this.getResolution(current.quality) > this.getResolution(prev.quality)
          ? current
          : prev,
      );
    }

    const requestedHeight = this.getRequestedHeight(requestedQuality);
    if (requestedHeight) {
      return mediaUrls.reduce((prev, current) =>
        Math.abs(this.getResolution(current.quality) - requestedHeight) <
        Math.abs(this.getResolution(prev.quality) - requestedHeight)
          ? current
          : prev,
      );
    }

    logger.warn(
      `Requested quality "${requestedQuality}" not found. Defaulting to highest quality.`,
    );
    return this.selectQuality(mediaUrls, "highest");
  }

  private getResolution(quality: string): number {
    const match = quality.match(/(\d+)x(\d+)/);
    return match ? parseInt(match[2]) : 0;
  }

  private getRequestedHeight(quality: string): number | null {
    const match = quality.match(/(\d+)p/);
    return match ? parseInt(match[1]) : null;
  }

  private async downloadMedia(
    selectedQuality: MediaInfo["urls"][0],
    downloadDir: string,
    title: string,
  ): Promise<string> {
    const sanitizedTitle = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const fileName = `${sanitizedTitle}_${selectedQuality.quality}.${selectedQuality.format}`;

    try {
      return await this.fileDownloader.downloadFile(
        selectedQuality.url,
        downloadDir,
        fileName,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            Referer: this.BASE_URL,
            Accept: "video/mp4,application/octet-stream;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
      );
    } catch (error) {
      logger.error(`Failed to download file: ${error}`);
      throw new DownloadError(`Failed to download file: ${error}`);
    }
  }
}
