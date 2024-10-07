import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {
    PlatformNotSupportedError,
    MediaNotFoundError,
    DownloadError,
    RateLimitError,
} from '@/types/errors';
import {HttpClient} from '@/utils/http-client';
import {downloadFile} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import axios, {AxiosResponse} from 'axios';
import qs from 'qs';
import vm from 'vm';
import * as cheerio from 'cheerio';

/**
 * InstagramHandler extracts direct media URLs from Instagram posts using a third-party API.
 */
class InstagramHandler implements PlatformHandler {
    private readonly BASE_URL: string;
    private readonly headers: Record<string, string>;

    constructor() {
        this.BASE_URL = 'https://v3.savevid.net/api/ajaxSearch';
        this.headers = {
            accept: '*/*',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Referer: 'https://savevid.net/',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        };
    }

    public isValidUrl(url: string): boolean {
        const instagramRegex = /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/.+$/;
        return instagramRegex.test(url);
    }

    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const httpClient = new HttpClient(config);

            const htmlContent = await this.fetchMediaPage(url, httpClient);
            const mediaUrls = this.extractMediaUrls(htmlContent, options);

            if (mediaUrls.length === 0) {
                throw new MediaNotFoundError(
                    'No media found at the provided Instagram URL.'
                );
            }

            const metadata = await this.extractMetadata(url, httpClient);

            // Build the MediaInfo object
            const mediaInfo: MediaInfo = {
                urls: mediaUrls.map(mediaUrl => ({
                    url: mediaUrl.url,
                    quality: mediaUrl.quality || 'unknown',
                    format: mediaUrl.format || 'unknown',
                    size: mediaUrl.size || 0, // Size in MB, set to 0 if unknown
                })),
                metadata: {
                    title: metadata.title || '',
                    author: metadata.author || '',
                    platform: 'Instagram',
                    views: metadata.views,
                    likes: metadata.likes,
                },
            };

            // Handle media download if requested
            if (options.downloadMedia) {
                const downloadDir = config.downloadDir;
                const localPaths = [];

                for (const mediaItem of mediaInfo.urls) {
                    const fileName = this.getFileNameFromUrl(mediaItem.url);
                    const localPath = await downloadFile(
                        mediaItem.url,
                        downloadDir || './downloads',
                        fileName,
                        config
                    );
                    localPaths.push(localPath);
                }

                mediaInfo.localPath = localPaths.join(', '); // Concatenate local paths if multiple
            }

            return mediaInfo;
        } catch (error) {
            logger.error(`Error fetching Instagram media info: ${error}`);
            if (
                error instanceof PlatformNotSupportedError ||
                error instanceof MediaNotFoundError
            ) {
                throw error;
            } else {
                throw new DownloadError(
                    `Failed to get media info: ${(error as Error).message}`
                );
            }
        }
    }

    /**
     * Fetches the media page HTML content.
     * @param url The Instagram URL.
     * @param httpClient The HttpClient instance.
     */
    private async fetchMediaPage(url: string, httpClient: HttpClient): Promise<string> {
        try {
            const params = {
                q: url,
                t: 'media',
                lang: 'en',
                v: 'v2',
            };

            const response: AxiosResponse<any> = await httpClient.post(
                this.BASE_URL,
                qs.stringify(params),
                {
                    headers: this.headers,
                    responseType: 'json',
                }
            );

            const responseData: string = response.data.data;

            if (!responseData) {
                throw new MediaNotFoundError('Empty response data.');
            }

            if (responseData.trim().startsWith('var')) {
                return this.executeJavaScript(responseData);
            } else if (responseData.trim().startsWith('<ul class="download-box">')) {
                // Directly return HTML content
                return responseData;
            } else {
                throw new MediaNotFoundError('Unexpected response format.');
            }
        } catch (error) {
            logger.error(`Error fetching media page: ${error}`);
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                throw new RateLimitError('Rate limit exceeded. Consider using a proxy.');
            }
            throw new DownloadError(
                `Failed to fetch media page: ${(error as Error).message}`
            );
        }
    }

    /**
     * Executes obfuscated JavaScript code to extract HTML content.
     * @param code The JavaScript code to execute.
     */
    private executeJavaScript(code: string): string {
        const sandbox = {
            result: '',
            document: {
                write: (html: string) => {
                    sandbox.result += html;
                },
            },
            window: {
                location: {
                    hostname: 'savevid.net',
                },
            },
            console: {
                log: () => {},
                error: () => {},
            },
        };

        try {
            const script = new vm.Script(code);
            const context = vm.createContext(sandbox);
            script.runInContext(context);
        } catch (error) {
            logger.error(`Error executing JavaScript: ${error}`);
            throw new DownloadError('Error executing response script.');
        }
        return sandbox.result;
    }

    /**
     * Extracts media URLs from the HTML content.
     * @param html The HTML content.
     * @param options Download options.
     */
    private extractMediaUrls(
        html: string,
        options: Required<DownloadOptions>
    ): Array<{url: string; quality?: string; format?: string; size?: number}> {
        const $ = cheerio.load(html);
        const mediaUrls: Array<{
            url: string;
            quality?: string;
            format?: string;
            size?: number;
        }> = [];

        $('.download-items').each((_, element) => {
            const videoDownloadLink = $(element)
                .find('.download-items__btn:not(.dl-thumb) > a')
                .attr('href');

            if (videoDownloadLink) {
                // It's a video
                const quality = $(element).find('.download-items__title').text().trim();
                mediaUrls.push({
                    url: videoDownloadLink,
                    quality: quality || 'unknown',
                    format: 'mp4',
                });
            } else {
                // Handle images with multiple quality options
                let qualityOptions = $(element)
                    .find('.photo-option select option')
                    .map((_, option) => ({
                        url: $(option).attr('value'),
                        dimensions: $(option).text().trim(),
                    }))
                    .get();

                // Sort from highest to lowest resolution
                qualityOptions.sort((a, b) => {
                    const [aWidth, aHeight] = a.dimensions.split('x').map(Number);
                    const [bWidth, bHeight] = b.dimensions.split('x').map(Number);
                    return bWidth * bHeight - aWidth * aHeight;
                });

                let selectedOption;
                if (options.quality && options.quality !== 'highest') {
                    selectedOption = qualityOptions.find(
                        option => option.dimensions === options.quality
                    );
                }

                if (!selectedOption) {
                    selectedOption = qualityOptions[0];
                }

                if (selectedOption) {
                    mediaUrls.push({
                        url: selectedOption.url,
                        quality: selectedOption.dimensions,
                        format: 'jpg', // Assuming it's an image
                    });
                } else {
                    logger.error('No suitable quality option found');
                }
            }
        });

        // Fallback for single image/video
        if (mediaUrls.length === 0) {
            const shareLink = $('a[onclick="showShare()"]').attr('href');
            if (shareLink) {
                mediaUrls.push({
                    url: shareLink,
                    format: 'unknown',
                });
            }
        }

        return mediaUrls;
    }

    /**
     * Extracts metadata from the Instagram media page.
     * @param url The Instagram URL.
     * @param httpClient The HttpClient instance.
     */
    private async extractMetadata(
        url: string,
        httpClient: HttpClient
    ): Promise<{title?: string; author?: string; views?: number; likes?: number}> {
        try {
            const response = await httpClient.get<string>(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AcmeInc/1.0)',
                },
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // Extract metadata
            const rawData = $('script[type="application/ld+json"]').first().html();
            if (rawData) {
                const jsonData = JSON.parse(rawData);
                const title = jsonData.caption || '';
                const author = jsonData.author?.alternateName || '';

                return {
                    title,
                    author,
                    views: undefined, // Not available in this context
                    likes: undefined,
                };
            } else {
                return {};
            }
        } catch (error) {
            logger.error(`Error extracting metadata: ${error}`);
            // Return partial metadata
            return {};
        }
    }

    /**
     * Generates a file name from a URL.
     * @param url The URL to extract the file name from.
     */
    private getFileNameFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.split('/').pop() || `downloaded_file_${Date.now()}`;
        } catch {
            return `downloaded_file_${Date.now()}`;
        }
    }
}

export default InstagramHandler;
