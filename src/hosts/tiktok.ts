import axios, {AxiosResponse, AxiosRequestConfig} from 'axios';
import * as cheerio from 'cheerio';
import {Downloader, DownloaderResult} from '@/types';

/**
 * Downloads and extracts media from TikTok videos using the internal API of musicaldown.
 * Supports downloading videos, images, and associated music.
 *
 * @testCases
 * video: https://www.tiktok.com/@stayc_official/video/7136124191849417985
 * short url: https://vm.tiktok.com/ZMrcQFHjd/
 * gallery: https://www.tiktok.com/@stressheadd/photo/7374028202378890528
 */
class TiktokDownloader implements Downloader {
    private readonly BASE_URL = 'https://musicaldown.com';
    private readonly API_URL = `${this.BASE_URL}/download`;
    private readonly AXIOS_TIMEOUT = 10000;
    private readonly MAX_RETRIES = 3;

    private async axiosWithRetry(
        config: AxiosRequestConfig,
        retries = 0
    ): Promise<AxiosResponse> {
        try {
            return await axios({...config, timeout: this.AXIOS_TIMEOUT});
        } catch (error) {
            if (retries < this.MAX_RETRIES) {
                const delay = Math.pow(2, retries) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.axiosWithRetry(config, retries + 1);
            }
            throw error;
        }
    }

    async getDirectUrls(url: string): Promise<DownloaderResult> {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            return {
                urls: mediaInfo,
            };
        } catch (error) {
            console.error(`Failed to process TikTok URL: ${(error as Error).message}`);
            return {urls: []};
        }
    }

    async getMetadata(url: string): Promise<Record<string, string>> {
        try {
            const response = await this.axiosWithRetry({
                method: 'get',
                url: url,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            });

            const $ = cheerio.load(response.data);
            const title = $('title').text();

            return {
                title: title,
                url: url,
            };
        } catch (error) {
            console.error(`Failed to fetch metadata: ${(error as Error).message}`);
            return {url: url};
        }
    }

    private async getMediaInfo(url: string): Promise<string[]> {
        const request = await this.getRequest(url);
        if (request.status !== 'success' || !request.request || !request.cookie) {
            throw new Error(request.message || 'Failed to get request data');
        }

        const response = await this.axiosWithRetry({
            method: 'post',
            url: this.API_URL,
            data: new URLSearchParams(Object.entries(request.request)),
            headers: {
                cookie: request.cookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                Origin: 'https://musicaldown.com',
                Referer: 'https://musicaldown.com/en',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent':
                    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
            },
        });

        const $ = cheerio.load(response.data);

        const images = $("div.row > div[class='col s12 m3'] img")
            .map((_, el) => $(el).attr('src'))
            .get();
        const videos = $("div[class='col s12 l8'] > a")
            .filter((_, el) => $(el).attr('href') !== '#modal2')
            .map((_, el) => $(el).attr('href'))
            .get();

        return images.length > 0 ? images : videos;
    }

    private async getRequest(url: string) {
        try {
            const response = await this.axiosWithRetry({
                method: 'get',
                url: this.BASE_URL,
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Update-Insecure-Requests': '1',
                    'User-Agent':
                        'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                },
            });

            const cookie = response.headers['set-cookie']?.[0]?.split(';')[0];
            if (!cookie) {
                throw new Error('Cookie not found in response headers');
            }

            const $ = cheerio.load(response.data);
            const input = $('div > input');

            const request = {
                [input.eq(0).attr('name') || '']: url,
                [input.eq(1).attr('name') || '']: input.eq(1).attr('value') || '',
                [input.eq(2).attr('name') || '']: input.eq(2).attr('value') || '',
            };

            return {status: 'success', request, cookie};
        } catch {
            return {status: 'error', message: 'Failed to get the request form!'};
        }
    }
}

export default TiktokDownloader;
