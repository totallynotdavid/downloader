import {
  DownloaderConfig,
  DownloadOptions,
  MediaInfo,
  PlatformHandler,
  TwitterApiResponse,
  TwitterMediaItem,
} from "@/types";
import { HttpClient } from "@/utils/http-client";
import { FileDownloader } from "@/utils/file-downloader";
import { MediaNotFoundError, DownloadError } from "@/types/errors";
import logger from "@/utils/logger";
import path from "node:path";

export default class TwitterHandler implements PlatformHandler {
  private static readonly BASE_URL: string = "https://api.vxtwitter.com";

  constructor(
    private readonly httpClient: HttpClient,
    private readonly fileDownloader: FileDownloader,
  ) {}

  public isValidUrl(url: string): boolean {
    const pattern = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)/i;
    return pattern.test(url);
  }

  public async getMediaInfo(
    url: string,
    options: Required<DownloadOptions>,
    config: DownloaderConfig,
  ): Promise<MediaInfo> {
    try {
      const mediaInfo = await this.fetchMediaInfo(url);
      const tweetID = mediaInfo.tweetID;
      let mediaUrls = this.extractMediaUrls(mediaInfo.media_extended);

      if (options.downloadMedia) {
        mediaUrls = await this.downloadMedia(
          mediaUrls,
          config.downloadDir,
          tweetID,
        );
      }

      const metadata = this.buildMetadata(mediaInfo);

      return {
        urls: mediaUrls,
        metadata,
      };
    } catch (error) {
      logger.error(`Error in TwitterHandler getMediaInfo: ${error}`);
      if (error instanceof MediaNotFoundError) {
        throw error;
      }
      throw new DownloadError(
        "Failed to retrieve media information from Twitter.",
      );
    }
  }

  private async fetchMediaInfo(url: string): Promise<TwitterApiResponse> {
    try {
      const apiURL = `${TwitterHandler.BASE_URL}${new URL(url).pathname}`;
      const response = await this.httpClient.get<TwitterApiResponse>(apiURL);
      const data = response.data;

      if (!data || !data.media_extended || data.media_extended.length === 0) {
        throw new MediaNotFoundError("No media found in the Twitter post.");
      }

      return data;
    } catch (error) {
      logger.error(`Error fetching Twitter data: ${error}`);
      if (error instanceof MediaNotFoundError) {
        throw error;
      }
      throw new DownloadError("Error fetching data from Twitter API.");
    }
  }

  private extractMediaUrls(mediaItems: TwitterMediaItem[]): MediaInfo["urls"] {
    return mediaItems.map((mediaItem) => ({
      url: mediaItem.url,
      quality: "original",
      format: this.getFileExtension(mediaItem.url),
      size: 0,
    }));
  }

  private getFileExtension(url: string): string {
    const extension = path
      .extname(new URL(url).pathname)
      .toLowerCase()
      .slice(1);
    return extension || "unknown";
  }

  private async downloadMedia(
    mediaUrls: MediaInfo["urls"],
    downloadDir: string,
    tweetID: string,
  ): Promise<MediaInfo["urls"]> {
    const downloadPromises = mediaUrls.map(async (urlInfo, index) => {
      try {
        const filename = `twitter_${tweetID}_${index + 1}.${urlInfo.format}`;
        const localPath = await this.fileDownloader.downloadFile(
          urlInfo.url,
          downloadDir,
          filename,
        );
        return { ...urlInfo, localPath };
      } catch (error) {
        logger.error(`Failed to download file: ${error}`);
        return urlInfo;
      }
    });
    return Promise.all(downloadPromises);
  }

  private buildMetadata(mediaInfo: TwitterApiResponse): MediaInfo["metadata"] {
    return {
      title: mediaInfo.text || "",
      author: this.formatAuthorName(mediaInfo),
      platform: "Twitter",
      views: mediaInfo.views || 0,
      likes: mediaInfo.likes || 0,
    };
  }

  private formatAuthorName(mediaInfo: TwitterApiResponse): string {
    const name = mediaInfo.user_name || "";
    const username = mediaInfo.user_screen_name || "";
    if (name && username) {
      return `${name} (@${username})`;
    } else if (name) {
      return name;
    } else if (username) {
      return `@${username}`;
    }
    return "";
  }
}
