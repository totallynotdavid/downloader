import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '../types';
import {MediaNotFoundError, RateLimitError, DownloadError} from '../types/errors';
import {HttpClient} from '../utils/http-client';
import {downloadFile} from '../utils/file-downloader';
import logger from '../utils/logger';
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

    /**
     * Checks if the provided URL is a valid Pinterest URL.
     * @param url The URL to check.
     * @returns True if valid, false otherwise.
     */
    public isValidUrl(url: string): boolean {
        return /pinterest\.com\/pin\/\d+/i.test(url);
    }

    /**
     * Fetches media information from a Pinterest URL.
     * @param url The Pinterest media URL.
     * @param options Download options.
     * @param config Downloader configuration.
     * @returns MediaInfo object containing media details.
     */
    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const mediaInfo = await this.fetchMediaInfo(url, config);

            // Process mediaInfo to fit the MediaInfo type expected
            const videoMedia = mediaInfo.medias.find(media => media.videoAvailable);
            const imageMedia = mediaInfo.medias.find(media => !media.videoAvailable);

            if (!videoMedia && !imageMedia) {
                throw new MediaNotFoundError(
                    'No media found at the provided Pinterest URL.'
                );
            }

            const urls = [];

            if (videoMedia) {
                urls.push({
                    url: videoMedia.url,
                    quality: 'unknown',
                    format: 'mp4',
                    size: 0, // Size is unknown
                });
            } else if (imageMedia) {
                urls.push({
                    url: imageMedia.url,
                    quality: 'unknown',
                    format: 'jpg',
                    size: 0,
                });
            }

            const result: MediaInfo = {
                urls,
                metadata: {
                    title: mediaInfo.title || '',
                    author: '', // Pinterest API doesn't provide author info
                    platform: 'Pinterest',
                    views: undefined,
                    likes: undefined,
                },
            };

            // If downloadMedia is true, download the media
            if (options.downloadMedia) {
                const downloadUrl = urls[0].url; // Download the first available media
                const extension = videoMedia ? 'mp4' : 'jpg';
                const fileName = `pinterest_${crypto.randomBytes(8).toString('hex')}.${extension}`;
                const localPath = await downloadFile(
                    downloadUrl,
                    config.downloadDir || './downloads',
                    fileName,
                    config
                );
                result.localPath = localPath;
            }

            return result;
        } catch (error: any) {
            logger(`Error fetching media info from Pinterest: ${error.message}`);
            if (error.response && error.response.status === 429) {
                throw new RateLimitError('Rate limit exceeded.');
            } else if (error instanceof MediaNotFoundError) {
                throw error;
            } else {
                throw new DownloadError(`Failed to fetch media info: ${error.message}`);
            }
        }
    }

    /**
     * Internal method to fetch media information using the getindevice.com API.
     * @param url The Pinterest media URL.
     * @param config Downloader configuration.
     * @returns PinterestMediaInfo object.
     */
    private async fetchMediaInfo(
        url: string,
        config: DownloaderConfig
    ): Promise<PinterestMediaInfo> {
        const httpClient = new HttpClient(config);
        try {
            const cookies = await this.getCookies(httpClient);

            const response = await httpClient.post<PinterestMediaInfo>(
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
            logger(`Error fetching media info: ${error.message}`);
            if (error.code === 'ECONNABORTED') {
                throw new DownloadError('Request timed out. Please try again later.');
            }
            throw error;
        }
    }

    /**
     * Retrieves cookies required for authentication.
     * @param httpClient The HttpClient instance.
     * @returns Array of cookies.
     */
    private async getCookies(httpClient: HttpClient): Promise<string[]> {
        try {
            const response = await httpClient.get(this.COOKIE_URL);
            const setCookie = response.headers['set-cookie'];
            if (!setCookie) {
                throw new Error('No cookies received from the server.');
            }
            return setCookie;
        } catch (error) {
            logger(`Error getting cookies: ${error}`);
            throw new DownloadError('Failed to retrieve necessary cookies.');
        }
    }

    /**
     * Generates a secure random token string.
     * @returns A base64 encoded token string.
     */
    private generateSecureToken(): string {
        return crypto.randomBytes(16).toString('base64');
    }
}
