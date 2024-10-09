import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {MediaNotFoundError, DownloadError} from '@/types/errors';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import crypto from 'node:crypto';

interface PinterestMediaInfo {
    medias: {
        videoAvailable: boolean;
        audioAvailable: boolean;
        url: string;
        quality: string;
        extension: string;
        size: number;
    }[];
    title?: string;
}

export default class PinterestHandler implements PlatformHandler {
    private readonly BASE_URL: string =
        'https://getindevice.com/wp-json/aio-dl/video-data/';

    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {}

    public isValidUrl(url: string): boolean {
        return /pinterest\.com\/pin\/\d+/i.test(url);
    }

    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const mediaInfo = await this.fetchMediaInfo(url);
            const mediaUrl = this.processMediaInfo(mediaInfo, options);

            if (!mediaUrl) {
                throw new MediaNotFoundError(
                    'No suitable media found at the provided Pinterest URL.'
                );
            }

            let localPath: string | undefined;
            if (options.downloadMedia) {
                localPath = await this.downloadMedia(mediaUrl, config.downloadDir);
            }

            return {
                urls: [mediaUrl],
                metadata: {
                    title: mediaInfo.title || '',
                    author: '',
                    platform: 'Pinterest',
                    views: undefined,
                    likes: undefined,
                },
            };
        } catch (error: any) {
            logger.error(`Error processing Pinterest URL: ${error.message}`);
            throw error instanceof MediaNotFoundError || error instanceof DownloadError
                ? error
                : new DownloadError(`Failed to process Pinterest URL: ${error.message}`);
        }
    }

    private processMediaInfo(
        mediaInfo: PinterestMediaInfo,
        options: Required<DownloadOptions>
    ): MediaInfo['urls'][0] | null {
        const media =
            mediaInfo.medias.find(media =>
                options.preferAudio ? media.audioAvailable : media.videoAvailable
            ) || mediaInfo.medias[0]; // Fallback to first media if no match

        if (!media) return null;

        return {
            url: media.url,
            quality: media.quality,
            format: media.extension,
            size: this.convertBytesToMB(media.size),
        };
    }

    private convertBytesToMB(bytes: number): number {
        return Number((bytes / (1024 * 1024)).toFixed(2));
    }

    private async downloadMedia(
        urlInfo: MediaInfo['urls'][0],
        downloadDir: string
    ): Promise<string> {
        const fileName = `pinterest_${crypto.randomBytes(8).toString('hex')}.${urlInfo.format}`;
        try {
            return await this.fileDownloader.downloadFile(
                urlInfo.url,
                downloadDir,
                fileName
            );
        } catch (error) {
            logger.error(`Failed to download file: ${error}`);
            throw new DownloadError(`Failed to download file: ${error}`);
        }
    }

    private async fetchMediaInfo(url: string): Promise<PinterestMediaInfo> {
        const response = await this.httpClient.post<PinterestMediaInfo>(
            this.BASE_URL,
            new URLSearchParams({
                url: url,
                token: crypto.randomBytes(16).toString('base64'),
            }).toString(),
            {
                headers: {
                    'sec-ch-ua': '"Not)A;Brand";v="24", "Chromium";v="116"',
                    'sec-ch-ua-platform': '"Android"',
                    Referer: 'https://getindevice.com/pinterest-video-downloader/',
                    'sec-ch-ua-mobile': '?1',
                    'User-Agent':
                        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 10000,
            }
        );

        if (!response.data || !response.data.medias) {
            throw new DownloadError('Invalid response from the Pinterest API.');
        }

        return response.data;
    }
}
