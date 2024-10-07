import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {TwitterApiResponse, TwitterMediaItem} from '@/types/twitter';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import {MediaNotFoundError, DownloadError} from '@/types/errors';
import logger from '@/utils/logger';
import path from 'path';

export default class TwitterHandler implements PlatformHandler {
    private readonly BASE_URL: string = 'https://api.vxtwitter.com';

    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {}

    public isValidUrl(url: string): boolean {
        return /twitter\.com|x\.com/.test(url);
    }

    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const mediaInfo = await this.getMediaInfoFromApi(url);

            const mediaUrls = this.processMediaItems(mediaInfo.media_extended);

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

            if (options.downloadMedia) {
                result.localPath = await this.downloadMediaFiles(
                    mediaUrls,
                    config.downloadDir
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

    private async getMediaInfoFromApi(url: string): Promise<TwitterApiResponse> {
        try {
            const apiURL = `${this.BASE_URL}${new URL(url).pathname}`;
            const response = await this.httpClient.get<TwitterApiResponse>(apiURL);

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

    private processMediaItems(mediaItems: TwitterMediaItem[]): MediaInfo['urls'] {
        return mediaItems.map(mediaItem => ({
            url: mediaItem.url,
            quality: 'original',
            format: this.getFileExtension(mediaItem.url),
            size: 0, // Size is unknown at this point
        }));
    }

    private getFileExtension(url: string): string {
        const extension = path.extname(url).toLowerCase().slice(1);
        return extension || 'unknown';
    }

    private async downloadMediaFiles(
        mediaUrls: MediaInfo['urls'],
        downloadDir: string
    ): Promise<string> {
        const downloads = mediaUrls.map((media, index) =>
            this.fileDownloader.downloadFile(
                media.url,
                downloadDir,
                `twitter_media_${Date.now()}_${index + 1}.${media.format}`
            )
        );

        const localPaths = await Promise.all(downloads);
        return localPaths.join(', ');
    }
}
