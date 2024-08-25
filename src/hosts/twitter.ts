import axios, {AxiosResponse} from 'axios';

interface MediaItem {
    url: string;
    type: string;
}

interface MediaInfo {
    text: string;
    media: MediaItem[];
}

interface GetDirectUrlsAndCountOptions {
    buffer?: boolean;
    text?: boolean;
}

interface GetDirectUrlsAndCountResult {
    urls: string[];
    count: number;
    buffers?: (Buffer | null)[];
    text?: string;
}

interface VxTwitterApiResponse {
    text: string;
    media_extended: {
        url: string;
        type: string;
    }[];
}

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
class TwitterDownloader {
    private readonly BASE_URL: string;

    constructor() {
        this.BASE_URL = 'https://api.vxtwitter.com';
    }

    public async getDirectUrlsAndCount(
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
                            const response: AxiosResponse<ArrayBuffer> = await axios.get(
                                item.url,
                                {
                                    responseType: 'arraybuffer',
                                    timeout: 10000, // 10 seconds timeout
                                }
                            );
                            return Buffer.from(response.data);
                        } catch (error) {
                            console.warn('Error getting buffer:', error);
                            return null;
                        }
                    })
                );
            }

            if (options.text) {
                result.text = mediaInfo.text;
            }

            return result;
        } catch (error) {
            console.error('Error in getDirectUrlsAndCount:', error);
            throw new Error(
                `Failed to process Twitter URL: ${error instanceof Error ? error.message : String(error)}`
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
