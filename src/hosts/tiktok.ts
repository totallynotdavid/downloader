import axios, {AxiosResponse, AxiosRequestConfig} from 'axios';
import cheerio from 'cheerio';

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

interface Author {
    avatar: string | undefined;
    nickname: string;
}

interface MediaInfo {
    text: string;
    media: MediaItem[];
    author: Author;
    music: string | undefined;
}

interface GetDirectUrlsAndCountOptions {
    buffer?: boolean;
    text?: boolean;
}

interface GetDirectUrlsAndCountResult {
    urls: string[];
    count: number;
    buffers?: (Buffer | undefined)[];
    text?: string;
}

interface RequestResult {
    status: 'success' | 'error';
    request?: Record<string, string>;
    cookie?: string;
    message?: string;
}

interface MusicResult {
    status: 'success' | 'error';
    result?: string;
}

class TiktokDownloaderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TiktokDownloaderError';
    }
}

/**
 * Downloads and extracts media from TikTok videos using the internal API of musicaldown.
 * Supports downloading videos, images, and associated music.
 *
 * @testCases
 * video: https://www.tiktok.com/@stayc_official/video/7136124191849417985
 * gallery: [missing]
 */
class TiktokDownloader {
    private readonly BASE_URL: string;
    private readonly API_URL: string;
    private readonly MUSIC_API_URL: string;
    private readonly AXIOS_TIMEOUT: number = 10000; // 10 seconds
    private readonly MAX_RETRIES: number = 3;

    constructor() {
        this.BASE_URL = 'https://musicaldown.com';
        this.API_URL = `${this.BASE_URL}/download`;
        this.MUSIC_API_URL = `${this.BASE_URL}/mp3/download`;
    }

    private async axiosWithRetry(
        config: AxiosRequestConfig,
        retries: number = 0
    ): Promise<AxiosResponse> {
        try {
            return await axios({...config, timeout: this.AXIOS_TIMEOUT});
        } catch (error) {
            if (retries < this.MAX_RETRIES) {
                const delay = Math.pow(2, retries) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.axiosWithRetry(config, retries + 1);
            }
            throw error;
        }
    }

    async getDirectUrlsAndCount(
        url: string,
        options: GetDirectUrlsAndCountOptions = {}
    ): Promise<GetDirectUrlsAndCountResult> {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            const media = mediaInfo.media;

            const urlArray = media.map(item => item.url);

            const result: GetDirectUrlsAndCountResult = {
                urls: urlArray,
                count: urlArray.length,
            };

            if (options.buffer) {
                result.buffers = await Promise.all(
                    media.map(async item => {
                        try {
                            const response = await this.axiosWithRetry({
                                method: 'get',
                                url: item.url,
                                responseType: 'arraybuffer',
                            });
                            return Buffer.from(response.data);
                        } catch (error) {
                            console.warn('Error getting buffer:', error);
                            return undefined;
                        }
                    })
                );
            }

            if (options.text) {
                result.text = mediaInfo.text;
            }

            return result;
        } catch (error) {
            throw new TiktokDownloaderError(
                `Failed to process TikTok URL: ${(error as Error).message}`
            );
        }
    }

    async getMediaInfo(url: string): Promise<MediaInfo> {
        try {
            const request = await this.getRequest(url);
            if (request.status !== 'success' || !request.request || !request.cookie) {
                throw new TiktokDownloaderError(
                    request.message || 'Failed to get request data'
                );
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

            const images: string[] = [];
            $("div.row > div[class='col s12 m3']").each((_, el) => {
                const src = $(el).find('img').attr('src');
                if (src) images.push(src);
            });

            const videos: Record<string, string> = {};
            $("div[class='col s12 l8'] > a").each((i, el) => {
                const href = $(el).attr('href');
                if (href && href !== '#modal2') {
                    let text = $(el)
                        .text()
                        .trim()
                        .replace(/\s/, ' ')
                        .replace('arrow_downward', '')
                        .toLowerCase();
                    let key = text.includes('hd')
                        ? 'videoHD'
                        : text.includes('watermark')
                          ? 'videoWatermark'
                          : `video${i + 1}`;
                    videos[key] = href;
                }
            });

            const music = await this.getMusic(request.cookie);

            return {
                text: this.sanitizeHtml($('div.row > div > div > h2').eq(1).text()),
                media:
                    images.length > 0
                        ? images.map(url => ({url, type: 'image' as const}))
                        : Object.values(videos).map(url => ({
                              url,
                              type: 'video' as const,
                          })),
                author: {
                    avatar: $('div.img-area > img').attr('src'),
                    nickname: this.sanitizeHtml(
                        $('div.row > div > div > h2').eq(0).text()
                    ),
                },
                music: music.result,
            };
        } catch (error) {
            throw new TiktokDownloaderError(
                `Error fetching TikTok data: ${(error as Error).message}`
            );
        }
    }

    private sanitizeHtml(input: string): string {
        return input.replace(
            /[&<>"']/g,
            char =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                })[char] || char
        );
    }

    async getRequest(url: string): Promise<RequestResult> {
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
                throw new TiktokDownloaderError('Cookie not found in response headers');
            }

            const $ = cheerio.load(response.data);
            const input = $('div > input');

            const request: Record<string, string> = {
                [input.eq(0).attr('name') || '']: url,
                [input.eq(1).attr('name') || '']: input.eq(1).attr('value') || '',
                [input.eq(2).attr('name') || '']: input.eq(2).attr('value') || '',
            };

            return {status: 'success', request, cookie};
        } catch (error) {
            return {status: 'error', message: 'Failed to get the request form!'};
        }
    }

    async getMusic(cookie: string): Promise<MusicResult> {
        try {
            const response = await this.axiosWithRetry({
                method: 'get',
                url: this.MUSIC_API_URL,
                headers: {
                    cookie: cookie,
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent':
                        'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
                },
            });

            const $ = cheerio.load(response.data);
            const music = $('audio > source').attr('src');
            return {status: 'success', result: music};
        } catch (error) {
            return {status: 'error'};
        }
    }
}

export default TiktokDownloader;
