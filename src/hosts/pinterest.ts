import crypto from 'node:crypto';
import axios, {AxiosResponse} from 'axios';
import {DownloaderResult, DownloaderOptions, Metadata} from '@/types';

interface MediaInfo {
    medias: {
        videoAvailable: boolean;
        url: string;
    }[];
    title?: string;
}

/**
 * Extracts direct download URLs for Pinterest media using the internal getindevice.com API.
 * Supports both video and image content from Pinterest pins.
 * Implements cookie-based authentication and secure token generation.
 *
 * @testCases
 * https://es.pinterest.com/pin/805651820863629473/ - video
 * https://es.pinterest.com/pin/805651820858880488/ - image
 *
 */
class PinterestDownloader {
    private readonly BASE_URL: string =
        'https://getindevice.com/wp-json/aio-dl/video-data/';
    private readonly COOKIE_URL: string =
        'https://getindevice.com/pinterest-video-downloader/';

    public async getDirectUrls(
        url: string,
        options: DownloaderOptions = {}
    ): Promise<DownloaderResult> {
        try {
            const mediaInfo: MediaInfo = await this.getMediaInfo(url);

            const videoMedia = mediaInfo.medias.find(media => media.videoAvailable);
            const imageMedia = mediaInfo.medias.find(media => !media.videoAvailable);

            const urlArray: string[] = [];
            if (videoMedia) {
                urlArray.push(videoMedia.url);
            } else if (imageMedia) {
                urlArray.push(imageMedia.url);
            }

            const result: DownloaderResult = {
                urls: urlArray,
            };

            if (options.includeMetadata) {
                result.metadata = await this.getMetadata(url);
            }

            return result;
        } catch (error) {
            console.error('Error in getDirectUrls:', error);
            return {urls: []};
        }
    }

    public async getMetadata(url: string): Promise<Metadata> {
        try {
            const mediaInfo: MediaInfo = await this.getMediaInfo(url);
            return {
                title: mediaInfo.title || '',
                url: url,
            };
        } catch (error) {
            console.error('Error in getMetadata:', error);
            return {title: '', url: url};
        }
    }

    private async getMediaInfo(url: string): Promise<MediaInfo> {
        try {
            if (!/pinterest\.com|pin\.it/i.test(url)) {
                throw new Error('Invalid Pinterest URL');
            }

            const cookies = await this.getCookies();

            const response: AxiosResponse = await axios.post(
                this.BASE_URL,
                new URLSearchParams({
                    url: url,
                    token: this.generateSecureToken(),
                }),
                {
                    headers: {
                        'sec-ch-ua': '"Not)A;Brand";v="24", "Chromium";v="116"',
                        'sec-ch-ua-platform': '"Android"',
                        Referer: 'https://getindevice.com/pinterest-video-downloader/',
                        'sec-ch-ua-mobile': '?1',
                        'User-Agent':
                            'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                        Cookie: cookies.join('; '),
                    },
                    timeout: 10000,
                    validateStatus: (status: number) => status >= 200 && status < 300,
                }
            );

            const data = response.data;

            if (!data) {
                throw new Error('Invalid response from server');
            }

            return data as MediaInfo;
        } catch (error) {
            console.error('Error in getMediaInfo:', error);
            if (axios.isAxiosError(error) && error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
                throw new Error('Request timed out. Please try again later.');
            }
            throw new Error(`Error fetching Pinterest data: ${(error as Error).message}`);
        }
    }

    private async getCookies(): Promise<string[]> {
        try {
            const response: AxiosResponse = await axios.get(this.COOKIE_URL);
            return response.headers['set-cookie'] || [];
        } catch (error) {
            console.error('Error getting cookies:', error);
            throw new Error(
                'Failed to retrieve necessary cookies. Please try again later.'
            );
        }
    }

    private generateSecureToken(): string {
        return crypto.randomBytes(16).toString('base64');
    }
}

export default PinterestDownloader;
