import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {MediaNotFoundError, RateLimitError, DownloadError} from '@/types/errors';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import crypto from 'node:crypto';

interface PinterestMediaInfo {
    medias: {
        videoAvailable: boolean;
        url: string;
    }[];
    title?: string;
}

export default class PinterestHandler implements PlatformHandler {
    private readonly BASE_URL: string =
        'https://getindevice.com/wp-json/aio-dl/video-data/';
    private readonly COOKIE_URL: string =
        'https://getindevice.com/pinterest-video-downloader/';

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

            const videoMedia = mediaInfo.medias.find(media => media.videoAvailable);
            const imageMedia = mediaInfo.medias.find(media => !media.videoAvailable);

            if (!videoMedia && !imageMedia) {
                throw new MediaNotFoundError(
                    'No media found at the provided Pinterest URL.'
                );
            }

            let urls: MediaInfo['urls'] = [];

            if (videoMedia) {
                urls.push({
                    url: videoMedia.url,
                    quality: 'unknown',
                    format: 'mp4',
                    size: 0,
                });
            }
            if (imageMedia) {
                urls.push({
                    url: imageMedia.url,
                    quality: 'unknown',
                    format: 'jpg',
                    size: 0,
                });
            }

            if (options.downloadMedia) {
                urls = await this.downloadMedia(
                    urls,
                    config.downloadDir || './downloads'
                );
            }

            return {
                urls,
                metadata: {
                    title: mediaInfo.title || '',
                    author: '',
                    platform: 'Pinterest',
                    views: undefined,
                    likes: undefined,
                },
            };
        } catch (error: any) {
            logger.error(`Error fetching media info from Pinterest: ${error.message}`);
            if (error.response && error.response.status === 429) {
                throw new RateLimitError('Rate limit exceeded.');
            } else if (error instanceof MediaNotFoundError) {
                throw error;
            } else {
                throw new DownloadError(`Failed to fetch media info: ${error.message}`);
            }
        }
    }

    private async downloadMedia(
        urls: MediaInfo['urls'],
        downloadDir: string
    ): Promise<MediaInfo['urls']> {
        return Promise.all(
            urls.map(async (urlInfo, index) => {
                const fileName = `pinterest_${crypto.randomBytes(8).toString('hex')}_${index + 1}.${urlInfo.format}`;
                try {
                    const localPath = await this.fileDownloader.downloadFile(
                        urlInfo.url,
                        downloadDir,
                        fileName
                    );
                    return {...urlInfo, localPath};
                } catch (error) {
                    logger.error(`Failed to download file: ${error}`);
                    return urlInfo;
                }
            })
        );
    }

    private async fetchMediaInfo(url: string): Promise<PinterestMediaInfo> {
        try {
            const cookies = await this.getCookies();

            const response = await this.httpClient.post<PinterestMediaInfo>(
                this.BASE_URL,
                new URLSearchParams({
                    url: url,
                    token: this.generateSecureToken(),
                }).toString(),
                {
                    headers: {
                        'sec-ch-ua': '"Not)A;Brand";v="24", "Chromium";v="116"',
                        'sec-ch-ua-platform': '"Android"',
                        Referer: 'https://getindevice.com/pinterest-video-downloader/',
                        'sec-ch-ua-mobile': '?1',
                        'User-Agent':
                            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                        Cookie: cookies.join('; '),
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 10000,
                    validateStatus: (status: number) => status >= 200 && status < 300,
                }
            );

            if (!response.data || !response.data.medias) {
                throw new DownloadError('Invalid response from the Pinterest API.');
            }

            return response.data;
        } catch (error: any) {
            logger.error(`Error fetching media info: ${error.message}`);
            if (error.code === 'ECONNABORTED') {
                throw new DownloadError('Request timed out. Please try again later.');
            }
            throw error;
        }
    }

    private async getCookies(): Promise<string[]> {
        try {
            const response = await this.httpClient.get(this.COOKIE_URL);
            const setCookie = response.headers['set-cookie'];
            if (!setCookie) {
                throw new Error('No cookies received from the server.');
            }
            return setCookie;
        } catch (error) {
            logger.error(`Error getting cookies: ${error}`);
            throw new DownloadError('Failed to retrieve necessary cookies.');
        }
    }

    private generateSecureToken(): string {
        return crypto.randomBytes(16).toString('base64');
    }
}
