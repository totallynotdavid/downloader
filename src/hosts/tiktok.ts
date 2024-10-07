import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {DownloadError, MediaNotFoundError, RateLimitError} from '@/types/errors';
import {HttpClient} from '@/utils/http-client';
import logger from '@/utils/logger';
import {downloadFile} from '@/utils/file-downloader';
import * as cheerio from 'cheerio';

/**
 * TikTokHandler is responsible for extracting media information
 * and optionally downloading media from TikTok URLs.
 *
 * It uses the musicaldown.com service to fetch direct media URLs.
 */
export default class TikTokHandler implements PlatformHandler {
    private readonly BASE_URL = 'https://musicaldown.com';
    private readonly API_URL = `${this.BASE_URL}/download`;

    /**
     * Checks if the provided URL is a valid TikTok URL.
     * @param url The URL to check.
     * @returns True if the URL is a TikTok URL, false otherwise.
     */
    public isValidUrl(url: string): boolean {
        const regex = /^(https?:\/\/)?(www\.)?(m\.)?(tiktok\.com)\/.+$/;
        return regex.test(url);
    }

    /**
     * Fetches media information from a TikTok URL.
     * @param url The TikTok video URL.
     * @param options The download options.
     * @param config The downloader configuration.
     * @returns A promise that resolves to a MediaInfo object.
     */
    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        logger.info(`TikTokHandler: Fetching media info for URL: ${url}`);

        try {
            const httpClient = new HttpClient(config);

            // Prepare request data by fetching initial form and cookie
            const {cookie, requestData} = await this.getRequestData(httpClient, url);

            // Fetch media URLs from musicaldown.com
            const mediaUrls = await this.getMediaUrls(httpClient, requestData, cookie);

            // Fetch metadata from the TikTok page
            const metadata = await this.getMetadata(httpClient, url);

            // Build the MediaInfo object
            const mediaInfo: MediaInfo = {
                urls: mediaUrls,
                metadata: {
                    title: metadata.title,
                    author: metadata.author,
                    platform: 'TikTok',
                    views: metadata.views,
                    likes: metadata.likes,
                },
            };

            // If downloadMedia option is true, download the first media file
            if (options.downloadMedia && mediaInfo.urls.length > 0) {
                const media = mediaInfo.urls[0];
                const fileExtension = media.format || 'mp4';
                const fileName = `${metadata.title || 'tiktok_media'}.${fileExtension}`;
                const localPath = await downloadFile(
                    media.url,
                    config.downloadDir || './downloads',
                    fileName,
                    config
                );
                mediaInfo.localPath = localPath;
            }

            return mediaInfo;
        } catch (error: any) {
            logger.error(`TikTokHandler: Error fetching media info: ${error.message}`);

            if (error instanceof MediaNotFoundError || error instanceof RateLimitError) {
                throw error;
            } else {
                throw new DownloadError(`Failed to fetch media info: ${error.message}`);
            }
        }
    }

    /**
     * Prepares the request data required by musicaldown.com to process the TikTok URL.
     * @param httpClient The HTTP client instance.
     * @param url The TikTok video URL.
     * @returns An object containing the request data and cookie.
     */
    private async getRequestData(
        httpClient: HttpClient,
        url: string
    ): Promise<{cookie: string; requestData: any}> {
        try {
            const response = await httpClient.get(this.BASE_URL, {
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
        } catch (error: any) {
            throw new Error(`Failed to prepare request data: ${error.message}`);
        }
    }

    /**
     * Fetches media URLs by submitting the request data to musicaldown.com.
     * @param httpClient The HTTP client instance.
     * @param requestData The request data to submit.
     * @param cookie The session cookie.
     * @returns An array of media URL objects.
     */
    private async getMediaUrls(
        httpClient: HttpClient,
        requestData: any,
        cookie: string
    ): Promise<
        Array<{
            url: string;
            quality: string;
            format: string;
            size: number;
        }>
    > {
        try {
            const response = await httpClient.post(
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

            // Check for rate limit error
            if (
                response.data.includes('sending too many requests') ||
                response.status === 429
            ) {
                throw new RateLimitError('Rate limited by musicaldown.com');
            }

            // Extract video URLs
            const mediaUrls: Array<{
                url: string;
                quality: string;
                format: string;
                size: number;
            }> = [];

            // For videos
            $('a.button.is-info').each((_, element) => {
                const link = $(element).attr('href');
                const text = $(element).text().trim();
                if (link && text.includes('Without Watermark')) {
                    mediaUrls.push({
                        url: link,
                        quality: 'Unknown',
                        format: 'mp4',
                        size: 0, // Size can be determined later if needed
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

    /**
     * Fetches metadata from the TikTok page.
     * @param httpClient The HTTP client instance.
     * @param url The TikTok video URL.
     * @returns An object containing metadata like title and author.
     */
    private async getMetadata(
        httpClient: HttpClient,
        url: string
    ): Promise<{title: string; author: string; views?: number; likes?: number}> {
        try {
            const response = await httpClient.get(url, {
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });

            const $ = cheerio.load(response.data);

            const title = $('title').text().trim();
            const author = $('meta[name="author"]').attr('content') || '';
            // Optionally, extract views and likes if available
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
        } catch (error: any) {
            // If metadata can't be fetched, return default values
            logger.error(`Unable to fetch metadata: ${error.message}`);
            return {
                title: 'TikTok Video',
                author: '',
            };
        }
    }
}
