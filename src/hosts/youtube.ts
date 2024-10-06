import https from 'node:https';
import querystring from 'querystring';
import {DownloaderResult, DownloaderOptions, Downloader} from '@/types';

/**
 * A utility class for extracting direct download URLs from YouTube videos.
 * Utilizes the internal y2mate.com API to fetch and convert video links.
 * Supports both MP3 and MP4 formats.
 *
 * @testCases
 * https://www.youtube.com/watch?v=PEECtnSQ6CY (length = 47 min.)
 * https://www.youtube.com/watch?v=Yvts2CHLOlU (length = 9 min.)
 * https://www.youtube.com/watch?v=cvVtbenDZxA (length = 4 min.)
 */
class YouTubeDownloader implements Downloader {
    private readonly SUPPORTED_SERVERS = ['en', 'id', 'es'] as const;
    private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

    async getDirectUrls(
        url: string,
        options: DownloaderOptions = {}
    ): Promise<DownloaderResult> {
        try {
            if (!this.isValidYoutubeUrl(url)) {
                throw new Error('Invalid YouTube URL');
            }

            const cookies = await this.fetchCookies();
            const videoId = this.extractVideoId(url);
            const downloadUrls = await this.getDownloadUrls(videoId, cookies, options);

            return {
                urls: downloadUrls,
            };
        } catch (error) {
            console.error(
                'YouTube Downloader error:',
                error instanceof Error ? error.message : 'Unknown error'
            );
            return {urls: []};
        }
    }

    async getMetadata(url: string): Promise<Record<string, unknown>> {
        if (!this.isValidYoutubeUrl(url)) {
            throw new Error('Invalid YouTube URL');
        }

        const videoId = this.extractVideoId(url);
        const cookies = await this.fetchCookies();
        const postData = querystring.stringify({
            vid: videoId,
            k_query: `https://www.youtube.com/watch?v=${videoId}`,
            k_page: 'home',
            hl: this.SUPPORTED_SERVERS[0],
            q_auto: 0,
        });

        const response = await this.makeHttpRequest<any>(
            'www.y2mate.com',
            '/mates/analyzeV2/ajax',
            'POST',
            postData,
            cookies
        );

        return {
            title: response.title || 'Unknown Title',
            url: `https://www.youtube.com/watch?v=${videoId}`,
        };
    }

    private async getDownloadUrls(
        videoId: string,
        cookies: string[],
        options: DownloaderOptions
    ): Promise<string[]> {
        const postData = querystring.stringify({
            vid: videoId,
            k_query: `https://www.youtube.com/watch?v=${videoId}`,
            k_page: 'home',
            hl: this.SUPPORTED_SERVERS[0],
            q_auto: 0,
        });

        const response = await this.makeHttpRequest<any>(
            'www.y2mate.com',
            '/mates/analyzeV2/ajax',
            'POST',
            postData,
            cookies
        );

        const downloadUrls: string[] = [];
        const formats = options.preferAudio ? ['mp3'] : ['mp4', 'mp3'];

        for (const format of formats) {
            for (const key in response.links[format]) {
                const item = response.links[format][key];
                if (item.f === format) {
                    if (this.isQualityAcceptable(item.q, options.quality)) {
                        const convertResponse = await this.convertMedia(
                            videoId,
                            item.k,
                            cookies
                        );
                        if (
                            convertResponse.dlink &&
                            (!options.maxSize ||
                                this.isWithinSizeLimit(
                                    convertResponse.size,
                                    options.maxSize
                                ))
                        ) {
                            downloadUrls.push(convertResponse.dlink);
                            if (options.preferAudio) return downloadUrls; // Return immediately for audio-only preference
                        }
                    }
                }
            }
        }

        return downloadUrls;
    }

    private isQualityAcceptable(itemQuality: string, requestedQuality?: string): boolean {
        if (!requestedQuality || requestedQuality === 'highest') return true;
        const qualityMap: Record<string, number> = {
            '144p': 1,
            '240p': 2,
            '360p': 3,
            '480p': 4,
            '720p': 5,
            '1080p': 6,
            '1440p': 7,
            '2160p': 8,
        };
        return qualityMap[itemQuality] <= qualityMap[requestedQuality];
    }

    private isWithinSizeLimit(size: string, maxSize?: number): boolean {
        if (!maxSize) return true;
        const sizeInMB = parseFloat(size);
        return !isNaN(sizeInMB) && sizeInMB <= maxSize;
    }

    private async convertMedia(
        videoId: string,
        key: string,
        cookies: string[]
    ): Promise<any> {
        const postData = querystring.stringify({vid: videoId, k: key});
        return this.makeHttpRequest(
            'www.y2mate.com',
            '/mates/convertV2/index',
            'POST',
            postData,
            cookies
        );
    }

    private async fetchCookies(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const req = https.get('https://www.y2mate.com/en872', res => {
                const cookiesArray = res.headers['set-cookie'];
                resolve(
                    cookiesArray || [
                        '_gid=GA1.2.2055666962.1683248123',
                        '_ga=GA1.1.1570308475.1683248122',
                        '_ga_K8CD7CY0TZ=GS1.1.1683248122.1.1.1683248164.0.0.0',
                        'prefetchAd_3381349=true',
                    ]
                );
            });

            req.on('error', e =>
                reject(new Error(`Failed to fetch cookies: ${e.message}`))
            );
            req.setTimeout(this.DEFAULT_TIMEOUT, () => {
                req.destroy();
                reject(new Error('Request to fetch cookies timed out'));
            });
        });
    }

    private isValidYoutubeUrl(url: string): boolean {
        const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        return youtubeUrlRegex.test(url);
    }

    private extractVideoId(url: string): string {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        return urlObj.searchParams.get('v') || '';
    }

    private makeHttpRequest<T>(
        hostname: string,
        path: string,
        method: string,
        postData: string,
        cookies: string[]
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const options: https.RequestOptions = {
                hostname: hostname,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Cookie: cookies.join('; '),
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                },
                timeout: this.DEFAULT_TIMEOUT,
            };

            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error('Failed to parse API response'));
                    }
                });
            });

            req.on('error', e => reject(new Error(`HTTP request failed: ${e.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('HTTP request timed out'));
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }
}

export default YouTubeDownloader;
