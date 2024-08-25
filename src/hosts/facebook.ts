import axios, {AxiosResponse} from 'axios';
import * as querystring from 'querystring';
import * as https from 'https';

const agent = new https.Agent();

interface MediaInfo {
    title: string;
    duration: string;
    thumbnail: string;
    links: {
        hd: string | string[];
        sd: string | string[];
    };
}

interface DirectUrlsAndCount {
    urls: string[];
    count: number;
}

type Quality = 'sd' | 'hd';

/**
 * Extracts direct download URLs for Facebook videos using the internal x2download API.
 * Supports both standard video URLs and short share links.
 * Provides options for HD and SD quality downloads.
 *
 * @testCases
 * https://www.facebook.com/1551UNMSM/videos/2126724314377208 (standard video URL)
 * https://www.facebook.com/share/v/Hr3BZV9JjaKPy28P/ (short share link for the same video)
 */
class FacebookDownloader {
    private readonly BASE_URL: string;

    constructor() {
        // Base URL for the x2download API
        // Note: Using direct IP address to avoid ENOTFOUND errors
        // TODO: Implement DNS lookup to get the current IP for x2download.app
        this.BASE_URL = 'https://172.67.222.44/api/ajaxSearch/facebook';
    }

    async getDirectUrlsAndCount(
        url: string,
        quality: Quality = 'sd'
    ): Promise<DirectUrlsAndCount> {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            const selectedUrls =
                quality === 'hd' ? mediaInfo.links.hd : mediaInfo.links.sd;
            const urlArray = Array.isArray(selectedUrls) ? selectedUrls : [selectedUrls];

            return {
                urls: urlArray,
                count: urlArray.length,
            };
        } catch (error) {
            this.handleError('getDirectUrlsAndCount', error);
            throw new Error(
                `Failed to process Facebook URL: ${this.getErrorMessage(error)}`
            );
        }
    }

    private async getMediaInfo(url: string): Promise<MediaInfo> {
        try {
            const encodedUrl = querystring.escape(url);
            const response = await this.makeRequest(encodedUrl);
            return this.parseResponse(response.data);
        } catch (error) {
            this.handleError('getMediaInfo', error);
            throw new Error(
                `Error fetching Facebook data: ${this.getErrorMessage(error)}`
            );
        }
    }

    private async makeRequest(
        encodedUrl: string,
        retries: number = 3
    ): Promise<AxiosResponse> {
        try {
            return await axios({
                method: 'post',
                url: this.BASE_URL,
                headers: {
                    Host: 'x2download.app',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                data: `q=${encodedUrl}`,
                httpsAgent: agent,
                timeout: 10000,
            });
        } catch (error) {
            if (retries > 0) {
                console.warn(`Request failed, retrying... (${retries} attempts left)`);
                return this.makeRequest(encodedUrl, retries - 1);
            }
            throw error;
        }
    }

    private parseResponse(data: any): MediaInfo {
        if (!data || !data.links || (!data.links.hd && !data.links.sd)) {
            throw new Error('Invalid response from server');
        }

        return {
            title: data.title,
            duration: data.duration,
            thumbnail: data.thumbnail,
            links: {
                hd: data.links.hd,
                sd: data.links.sd,
            },
        };
    }

    private handleError(methodName: string, error: unknown): void {
        console.error(`Error in ${methodName}:`, error);
        if (axios.isAxiosError(error)) {
            console.error(`Axios error details: ${JSON.stringify(error.response?.data)}`);
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        return String(error);
    }
}

export default FacebookDownloader;
