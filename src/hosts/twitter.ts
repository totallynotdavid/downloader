import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '../types';
import {HttpClient} from '../utils/http-client';
import {MediaNotFoundError, DownloadError} from '../types/errors';
import logger from '../utils/logger';
import {downloadFile} from '../utils/file-downloader';

/**
 * TwitterHandler implements the PlatformHandler interface to handle media extraction from Twitter URLs.
 * It utilizes the vxtwitter.com API to retrieve media information and direct URLs.
 */
export default class TwitterHandler implements PlatformHandler {
    private readonly BASE_URL: string;
    private readonly httpClient: HttpClient;

    constructor() {
        this.BASE_URL = 'https://api.vxtwitter.com';
        this.httpClient = new HttpClient({});
    }

    /**
     * Checks if the provided URL is a valid Twitter URL.
     * @param url The URL to validate.
     * @returns True if valid, false otherwise.
     */
    public isValidUrl(url: string): boolean {
        return /twitter\.com|x\.com/.test(url);
    }

    /**
     * Retrieves media information from a Twitter post.
     * @param url The Twitter post URL.
     * @param options Download options.
     * @param config Downloader configuration.
     * @returns MediaInfo object containing media URLs and metadata.
     */
    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const mediaInfo = await this.getMediaInfoFromApi(url, config);

            const mediaUrls = mediaInfo.media.map(
                (mediaItem: {url: string; type: string}) => ({
                    url: mediaItem.url,
                    quality: 'unknown',
                    format: mediaItem.type,
                    size: 0, // Size is unknown at this point
                })
            );

            const result: MediaInfo = {
                urls: mediaUrls,
                metadata: {
                    title: mediaInfo.text,
                    author: mediaInfo.user.username,
                    platform: 'Twitter',
                    views: mediaInfo.views,
                    likes: mediaInfo.likes,
                },
            };

            // If downloadMedia is true, download the media files
            if (options.downloadMedia) {
                // You can implement the downloading logic here using your existing downloadFile function
                // For each media URL, download the file and store the local paths
                const downloadDir = config.downloadDir || './downloads';
                result.localPath = await this.downloadMediaFiles(
                    mediaUrls,
                    downloadDir,
                    config
                );
            }

            return result;
        } catch (error) {
            logger.error(`Error in TwitterHandler getMediaInfo: ${error}`);
            if (error instanceof MediaNotFoundError) {
                throw error;
            } else {
                throw new DownloadError(
                    'Failed to retrieve media information from Twitter.'
                );
            }
        }
    }

    /**
     * Helper function to fetch media information from the vxtwitter API.
     * @param url The Twitter post URL.
     * @param config Downloader configuration.
     * @returns Parsed media information.
     */
    private async getMediaInfoFromApi(
        url: string,
        config: DownloaderConfig
    ): Promise<any> {
        try {
            const apiURL = `${this.BASE_URL}${new URL(url).pathname}`;
            const response = await this.httpClient.get(apiURL);

            const data = response.data;

            if (!data || !data.media_extended || data.media_extended.length === 0) {
                throw new MediaNotFoundError('No media found in the Twitter post.');
            }

            return data;
        } catch (error) {
            logger.error(`Error fetching Twitter data: ${error}`);
            if (error instanceof MediaNotFoundError) {
                throw error;
            } else {
                throw new DownloadError('Error fetching data from Twitter API.');
            }
        }
    }

    /**
     * Downloads media files and returns the local path where they are stored.
     * @param mediaUrls Array of media URLs to download.
     * @param downloadDir Directory to save the downloaded media files.
     * @param config Downloader configuration.
     * @returns Local path to the downloaded media files.
     */
    private async downloadMediaFiles(
        mediaUrls: Array<{url: string; quality: string; format: string; size: number}>,
        downloadDir: string,
        config: DownloaderConfig
    ): Promise<string> {
        const mediaUrl = mediaUrls[0].url;
        const fileName = `twitter_media_${Date.now()}.${mediaUrls[0].format}`;
        const localPath = await downloadFile(mediaUrl, downloadDir, fileName, config);
        return localPath;
    }
}
