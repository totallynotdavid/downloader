import axios, {AxiosResponse} from 'axios';
import qs from 'qs';
import vm from 'node:vm';
import * as cheerio from 'cheerio';
import {DownloaderOptions, DownloaderResult} from '@/types';
import {Headers, MediaInfo, ApiResponse} from '@/types/instagram';

/**
 * Extracts direct media URLs for Instagram media using
 * the internal savevid.net API.
 *
 * @testCases
 * image (return 1 img): https://www.instagram.com/p/C-KmYkCsSr5/
 * gallery (return 10 imgs): https://www.instagram.com/p/C-4D2GJo9Cd/
 * reel (return 1 mp4): https://www.instagram.com/p/C-4BsEyOPQY/
 *
 */
class InstagramDownloader {
    private readonly BASE_URL: string;
    private readonly headers: Headers;

    constructor() {
        this.BASE_URL = 'https://v3.savevid.net/api/ajaxSearch';
        this.headers = {
            accept: '*/*',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Referer: 'https://savevid.net/',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        };
    }

    /**
     * Executes obfuscated JavaScript code in a sandboxed environment to extract injected HTML.
     * This function is primarily used for processing single image data from savevid.net.
     */
    private executeJavaScript(code: string): string {
        const sandbox = {
            result: '',
            document: {
                write: (html: string) => {
                    sandbox.result += html;
                },
                // Simulate document.getElementById() to capture injected content
                getElementById: (id: string) => ({
                    set innerHTML(content: string) {
                        if (id === 'download-result') {
                            sandbox.result = content;
                        }
                    },
                }),
            },
            window: {
                // Simulate the expected execution domain
                location: {
                    hostname: 'savevid.net',
                },
            },
            console: {
                log: (message: string) => {
                    console.log('Sandbox log:', message);
                },
                error: (message: string) => {
                    console.error('Sandbox error:', message);
                },
            },
        };

        try {
            const script = new vm.Script(code);
            const context = vm.createContext(sandbox);
            script.runInContext(context);
        } catch (error) {
            console.error('Error executing script:', error);
            console.error('Problematic code:', code);
        }
        return sandbox.result;
    }

    private parseHtml(html: string): MediaInfo {
        const $ = cheerio.load(html);
        const result: string[] = [];

        $('.download-items').each((_, element) => {
            const videoDownloadLink = $(element)
                .find('.download-items__btn:not(.dl-thumb) > a')
                .attr('href');

            if (videoDownloadLink) {
                result.push(videoDownloadLink);
            } else {
                const highestQualityOption = $(element)
                    .find('.photo-option select option')
                    .first()
                    .attr('value');

                const imageDownloadLink = $(element)
                    .find('.download-items__btn > a')
                    .attr('href');

                if (highestQualityOption) {
                    result.push(highestQualityOption);
                } else if (imageDownloadLink) {
                    result.push(imageDownloadLink);
                }
            }
        });

        // If no items found, check for a single share link (fallback for single image/video)
        if (result.length === 0) {
            const shareLink = $('a[onclick="showShare()"]').attr('href');
            if (shareLink) {
                result.push(shareLink);
            }
        }

        return {
            results_number: result.length,
            url_list: result,
        };
    }

    private async getMediaInfo(url: string): Promise<MediaInfo> {
        try {
            const params = {
                q: url,
                t: 'media',
                lang: 'en',
                v: 'v2',
            };

            const response: AxiosResponse<ApiResponse> = await axios.post(
                this.BASE_URL,
                qs.stringify(params),
                {
                    headers: this.headers,
                }
            );
            const responseData: string = response.data.data;

            console.log('responseData:', responseData)

            if (!responseData) {
                return {results_number: 0, url_list: []};
            }

            let htmlContent: string;
            if (responseData.trim().startsWith('var')) {
                htmlContent = this.executeJavaScript(responseData);
            } else if (responseData.trim().startsWith('<ul class="download-box">')) {
                htmlContent = responseData;
            } else {
                console.error('Unexpected response format');
                return {results_number: 0, url_list: []};
            }
            return this.parseHtml(htmlContent);
        } catch (error) {
            console.error('Error fetching Instagram data:', error);
            throw error;
        }
    }

    async getDirectUrls(
        url: string,
        options: DownloaderOptions = {}
    ): Promise<DownloaderResult> {
        try {
            const result = await this.getMediaInfo(url);
            let urls = result.url_list;

            // Apply quality filter if specified
            if (options.quality && options.quality !== 'highest') {
                // TODO: handle multiple qualities
                urls = urls.slice(0, 1);
            }

            return {
                urls,
            };
        } catch (error) {
            console.error(`Failed to process Instagram URL: ${(error as Error).message}`);
            return {urls: []};
        }
    }

    async getMetadata(url: string): Promise<Record<string, string>> {
        try {
            // TODO: add metadata
            return {url};
        } catch (error) {
            console.error(
                `Failed to fetch Instagram metadata: ${(error as Error).message}`
            );
            return {};
        }
    }
}

export default InstagramDownloader;
