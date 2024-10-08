import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {DownloadError, MediaNotFoundError, RateLimitError} from '@/types/errors';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import * as cheerio from 'cheerio';

export default class TikTokHandler implements PlatformHandler {
    private readonly BASE_URL = 'https://musicaldown.com';
    private readonly API_URL = `${this.BASE_URL}/download`;

    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {}

    public isValidUrl(url: string): boolean {
        const regex = /^(https?:\/\/)?(www\.)?(m\.)?(tiktok\.com)\/.+$/;
        return regex.test(url);
    }

    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        logger.info(`TikTokHandler: Fetching media info for URL: ${url}`);

        try {
            const {cookie, requestData} = await this.getRequestData(url);
            let mediaUrls = await this.getMediaUrls(requestData, cookie);
            const metadata = await this.getMetadata(url);

            if (options.downloadMedia) {
                mediaUrls = await this.downloadMedia(
                    mediaUrls,
                    config.downloadDir,
                    metadata.title
                );
            }

            return {
                urls: mediaUrls,
                metadata: {
                    title: metadata.title,
                    author: metadata.author,
                    platform: 'TikTok',
                    views: metadata.views,
                    likes: metadata.likes,
                },
            };
        } catch (error: any) {
            logger.error(`TikTokHandler: Error fetching media info: ${error.message}`);

            if (error instanceof MediaNotFoundError || error instanceof RateLimitError) {
                throw error;
            } else {
                throw new DownloadError(`Failed to fetch media info: ${error.message}`);
            }
        }
    }

    private async getRequestData(
        url: string
    ): Promise<{cookie: string; requestData: any}> {
        try {
            const response = await this.httpClient.get(this.BASE_URL, {
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent':
                        'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                },
            });

            const setCookieHeader = response.headers['set-cookie'];
            if (!setCookieHeader || setCookieHeader.length === 0) {
                throw new Error('No set-cookie header found in response');
            }
            const cookie = setCookieHeader[0].split(';')[0];

            const $ = cheerio.load(response.data);
            const inputs = $('form#form > input');

            const data: {[key: string]: string} = {};
            inputs.each((_, input) => {
                const name = $(input).attr('name');
                const value = $(input).attr('value') || '';
                if (name === 'link') {
                    data[name] = url;
                } else if (name) {
                    data[name] = value;
                }
            });

            return {cookie, requestData: data};
        } catch (error) {
            throw new Error(`Failed to prepare request data: ${error}`);
        }
    }

    private async getMediaUrls(
        requestData: any,
        cookie: string
    ): Promise<MediaInfo['urls']> {
        try {
            const response = await this.httpClient.post(
                this.API_URL,
                new URLSearchParams(requestData),
                {
                    headers: {
                        cookie: cookie,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Origin: this.BASE_URL,
                        Referer: `${this.BASE_URL}/en`,
                        'Upgrade-Insecure-Requests': '1',
                        'User-Agent':
                            'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                    },
                }
            );

            const $ = cheerio.load(response.data);

            if (
                response.data.includes('sending too many requests') ||
                response.status === 429
            ) {
                throw new RateLimitError('Rate limited by musicaldown.com');
            }

            const mediaUrls: MediaInfo['urls'] = [];

            // For videos
            $('a.button.is-info').each((_, element) => {
                const link = $(element).attr('href');
                const text = $(element).text().trim();
                if (link && text.includes('Without Watermark')) {
                    mediaUrls.push({
                        url: link,
                        quality: 'Unknown',
                        format: 'mp4',
                        size: 0,
                    });
                }
            });

            // For images (TikTok photo gallery)
            $('div.is-centered img').each((_, element) => {
                const src = $(element).attr('src');
                if (src) {
                    mediaUrls.push({
                        url: src,
                        quality: 'Unknown',
                        format: 'jpg',
                        size: 0,
                    });
                }
            });

            if (mediaUrls.length === 0) {
                throw new MediaNotFoundError(
                    'No media found for the provided TikTok URL.'
                );
            }

            return mediaUrls;
        } catch (error: any) {
            if (error instanceof RateLimitError) {
                throw error;
            }
            throw new Error(`Failed to retrieve media URLs: ${error.message}`);
        }
    }

    private async getMetadata(
        url: string
    ): Promise<{title: string; author: string; views?: number; likes?: number}> {
        try {
            const response = await this.httpClient.get(url, {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });

            const $ = cheerio.load(response.data);

            const title = $('title').text().trim();
            const author = $('meta[name="author"]').attr('content') || '';
            const viewsText = $('strong[data-e2e="video-views"]')
                .text()
                .replace(/[^\d]/g, '');
            const likesText = $('strong[data-e2e="like-count"]')
                .text()
                .replace(/[^\d]/g, '');
            const views = viewsText ? parseInt(viewsText, 10) : undefined;
            const likes = likesText ? parseInt(likesText, 10) : undefined;

            return {
                title,
                author,
                views,
                likes,
            };
        } catch (error) {
            logger.error(`Unable to fetch metadata: ${error}`);
            return {
                title: 'TikTok Video',
                author: '',
            };
        }
    }

    private async downloadMedia(
        urls: MediaInfo['urls'],
        downloadDir: string,
        title: string
    ): Promise<MediaInfo['urls']> {
        return Promise.all(
            urls.map(async (urlInfo, index) => {
                const sanitizedTitle = title
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '_');
                const fileName = `${sanitizedTitle}_${index + 1}.${urlInfo.format}`;

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
}
