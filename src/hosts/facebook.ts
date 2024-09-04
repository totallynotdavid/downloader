import https from 'node:https';
import axios, {AxiosInstance} from 'axios';
import * as querystring from 'querystring';
import {Downloader, DownloaderOptions, DownloaderResult} from '@/types';
import {MediaInfo, ApiResponse} from '@/types/facebook';
import {mapQualityToSite, QualityType} from '@/utils/mapQualityToSite';

/**
 * Extracts direct download URLs for Facebook videos using the internal x2download API.
 * Supports both standard video URLs and short share links.
 * Provides options for HD and SD quality downloads.
 *
 * @testCases
 * https://www.facebook.com/1551UNMSM/videos/2126724314377208 (standard video URL)
 * https://www.facebook.com/share/v/Hr3BZV9JjaKPy28P/ (short share link for the same video)
 */
class FacebookDownloader implements Downloader {
    private readonly BASE_URL: string;
    private readonly axiosInstance: AxiosInstance;

    constructor() {
        // Base URL for the x2download API
        // Note: Using direct IP address to avoid ENOTFOUND errors
        // TODO: Implement DNS lookup to get the current IP for x2download.app
        this.BASE_URL = 'https://172.67.222.44/api/ajaxSearch/facebook';

        this.axiosInstance = axios.create({
            httpsAgent: new https.Agent({keepAlive: true}),
            timeout: 10000,
            headers: {
                Host: 'x2download.app',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
        });
    }

    async getDirectUrls(
        url: string,
        options: DownloaderOptions = {}
    ): Promise<DownloaderResult> {
        const mediaInfo = await this.getMediaInfo(url);
        const quality = mapQualityToSite(
            (options.quality as QualityType) || 'highest',
            'facebook'
        );
        const selectedUrls = mediaInfo.links[quality.toLowerCase() as 'hd' | 'sd'] || [];

        const result: DownloaderResult = {
            urls: Array.isArray(selectedUrls) ? selectedUrls : [selectedUrls],
        };

        if (options.includeMetadata) {
            result.metadata = await this.getMetadata(url);
        }

        return result;
    }

    async getMetadata(url: string): Promise<Record<string, string>> {
        const mediaInfo = await this.getMediaInfo(url);
        return {
            url,
            title: mediaInfo.title,
            duration: mediaInfo.duration,
            thumbnail: mediaInfo.thumbnail,
        };
    }

    private async getMediaInfo(url: string): Promise<MediaInfo> {
        const encodedUrl = querystring.escape(url);
        const response = await this.axiosInstance.post(this.BASE_URL, `q=${encodedUrl}`);
        return this.parseResponse(response.data);
    }

    private parseResponse(data: ApiResponse): MediaInfo {
        if (!data) {
            throw new Error('No data received from server');
        }

        if (data.status !== 'ok' || (!data?.links?.hd && !data?.links?.sd)) {
            throw new Error('Invalid response from server');
        }

        return {
            status: data.status,
            p: data.p,
            urlHD: data.urlHD,
            links: data.links,
            duration: data.duration,
            title: data.title,
            thumbnail: data.thumbnail,
        };
    }
}

export default FacebookDownloader;
