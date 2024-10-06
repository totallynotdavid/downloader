import axios, {AxiosResponse} from 'axios';
import {Downloader, DownloaderOptions, DownloaderResult, Metadata} from '@/types';
import {MediaInfo, VxTwitterApiResponse} from '@/types/twitter';

/**
 * Downloads and extracts media from Twitter posts using the internal vxtwitter.com API.
 * Supports downloading images, videos, and associated text content.
 * Handles both twitter.com and x.com URLs.
 *
 * @testCases
 * single image: https://twitter.com/martinmbauer/status/1827230665932157320
 * gallery (2 imgs): https://twitter.com/violet_zct/status/1826243212530610389
 * video: https://twitter.com/ridd_design/status/1827005484156538976
 *
 */
class TwitterDownloader implements Downloader {
    private readonly BASE_URL: string;

    constructor() {
        this.BASE_URL = 'https://api.vxtwitter.com';
    }

    public async getDirectUrls(
        url: string,
        options: DownloaderOptions = {}
    ): Promise<DownloaderResult> {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            const media = mediaInfo.media;

            const urlArray = media.map(item => item.url);

            const result: DownloaderResult = {
                urls: urlArray,
            };

            // Twitter doesn't support quality selection or size limits
            if (options.quality || options.maxSize) {
                console.warn('Twitter does not support quality selection or size limits');
            }

            return result;
        } catch (error) {
            console.error('Error in getDirectUrls:', error);
            throw new Error(
                `Failed to process Twitter URL: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public async getMetadata(url: string): Promise<Metadata> {
        try {
            const mediaInfo = await this.getMediaInfo(url);
            return {
                title: mediaInfo.text,
                url: url,
            };
        } catch (error) {
            console.error('Error in getMetadata:', error);
            throw new Error(
                `Failed to get Twitter metadata: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async getMediaInfo(url: string): Promise<MediaInfo> {
        try {
            if (!/twitter\.com|x\.com/.test(url)) {
                throw new Error('Invalid Twitter URL');
            }

            const apiURL = `${this.BASE_URL}${new URL(url).pathname}`;
            const response: AxiosResponse<VxTwitterApiResponse> = await axios.get(
                apiURL,
                {
                    timeout: 10000, // 10 seconds timeout
                }
            );

            const data = response.data;

            if (!data || !data.media_extended) {
                throw new Error('No media found');
            }

            return {
                text: data.text,
                media: data.media_extended.map(mediaItem => ({
                    url: mediaItem.url,
                    type: mediaItem.type,
                })),
            };
        } catch (error) {
            console.error('Error in getMediaInfo:', error);
            if (axios.isAxiosError(error) && error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw new Error(
                `Error fetching Twitter data: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

export default TwitterDownloader;
