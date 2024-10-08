import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {
    PlatformNotSupportedError,
    MediaNotFoundError,
    DownloadError,
    RateLimitError,
} from '@/types/errors';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import {mergeOptions} from '@/utils/options-merger';
import axios from 'axios';
import qs from 'qs';
import vm from 'vm';
import * as cheerio from 'cheerio';

class InstagramHandler implements PlatformHandler {
    private readonly BASE_URL: string;
    private readonly headers: Record<string, string>;

    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {
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
        options: DownloadOptions,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        const mergedOptions = mergeOptions(options);
        try {
            const htmlContent = await this.fetchMediaPage(url);
            let mediaUrls = this.extractMediaUrls(htmlContent, mergedOptions);

            if (mediaUrls.length === 0) {
                throw new MediaNotFoundError(
                    'No media found at the provided Instagram URL.'
                );
            }

            const metadata = await this.extractMetadata(url);

            if (mergedOptions.downloadMedia) {
                mediaUrls = await this.downloadMedia(mediaUrls, config.downloadDir);
            }

            const mediaInfo: MediaInfo = {
                urls: mediaUrls,
                metadata: {
                    title: metadata.title || '',
                    author: metadata.author || '',
                    platform: 'Instagram',
                    views: metadata.views,
                    likes: metadata.likes,
                },
            };

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

    private async fetchMediaPage(url: string): Promise<string> {
        try {
            const params = {
                q: url,
                t: 'media',
                lang: 'en',
                v: 'v2',
            };

            const response = await this.httpClient.post<any>(
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

    private extractMediaUrls(
        html: string,
        options: Required<DownloadOptions>
    ): MediaInfo['urls'] {
        const $ = cheerio.load(html);
        const mediaUrls: MediaInfo['urls'] = [];

        $('.download-items').each((_, element) => {
            const videoDownloadLink = $(element)
                .find('.download-items__btn:not(.dl-thumb) > a')
                .attr('href');

            if (videoDownloadLink) {
                const quality = $(element).find('.download-items__title').text().trim();
                mediaUrls.push({
                    url: videoDownloadLink,
                    quality: quality || 'unknown',
                    format: 'mp4',
                    size: 0,
                });
            } else {
                let qualityOptions = $(element)
                    .find('.photo-option select option')
                    .map((_, option) => ({
                        url: $(option).attr('value'),
                        dimensions: $(option).text().trim(),
                    }))
                    .get();

                qualityOptions.sort((a, b) => {
                    const [aWidth, aHeight] = a.dimensions.split('x').map(Number);
                    const [bWidth, bHeight] = b.dimensions.split('x').map(Number);
                    return bWidth * bHeight - aWidth * aHeight;
                });

                let selectedOption =
                    qualityOptions.find(
                        option => option.dimensions === options.quality
                    ) || qualityOptions[0];

                if (selectedOption) {
                    mediaUrls.push({
                        url: selectedOption.url,
                        quality: selectedOption.dimensions,
                        format: 'jpg',
                        size: 0,
                    });
                } else {
                    logger.error('No suitable quality option found');
                }
            }
        });

        if (mediaUrls.length === 0) {
            const shareLink = $('a[onclick="showShare()"]').attr('href');
            if (shareLink) {
                mediaUrls.push({
                    url: shareLink,
                    quality: 'unknown',
                    format: 'unknown',
                    size: 0,
                });
            }
        }

        return mediaUrls;
    }

    private async extractMetadata(
        url: string
    ): Promise<{title?: string; author?: string; views?: number; likes?: number}> {
        try {
            const response = await this.httpClient.get<string>(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AcmeInc/1.0)',
                },
            });

            const $ = cheerio.load(response.data);
            const rawData = $('script[type="application/ld+json"]').first().html();

            if (rawData) {
                const jsonData = JSON.parse(rawData);
                return {
                    title: jsonData.caption || '',
                    author: jsonData.author?.alternateName || '',
                    views: undefined,
                    likes: undefined,
                };
            }
            return {};
        } catch (error) {
            logger.error(`Error extracting metadata: ${error}`);
            return {};
        }
    }

    private async downloadMedia(
        mediaUrls: MediaInfo['urls'],
        downloadDir: string
    ): Promise<MediaInfo['urls']> {
        return Promise.all(
            mediaUrls.map(async mediaItem => {
                const fileName = this.getFileNameFromUrl(mediaItem.url);
                try {
                    const localPath = await this.fileDownloader.downloadFile(
                        mediaItem.url,
                        downloadDir || './downloads',
                        fileName
                    );
                    return {...mediaItem, localPath};
                } catch (error) {
                    logger.error(`Failed to download file: ${error}`);
                    return mediaItem;
                }
            })
        );
    }

    private getFileNameFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.split('/').pop() || `instagram_media_${Date.now()}`;
        } catch {
            return `instagram_media_${Date.now()}`;
        }
    }
}

export default InstagramHandler;
