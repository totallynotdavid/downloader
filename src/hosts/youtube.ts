import {PlatformHandler, DownloadOptions, MediaInfo, DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {downloadFile} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import {MediaNotFoundError} from '@/types/errors';
import https from 'https';

class YouTubeHandler implements PlatformHandler {
    private readonly API_BASE_URL = 'https://www.y2mate.com/mates';
    private readonly VIDEO_URL_BASE = 'https://www.youtube.com/watch?v=';
    private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

    /**
     * Retrieves media information for a given YouTube URL.
     * @param url - The YouTube video URL.
     * @param options - Download options.
     * @param config - Downloader configuration.
     * @returns A promise that resolves to MediaInfo.
     */
    async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        logger.info('Starting getMediaInfo method.');

        if (!this.isValidUrl(url)) {
            logger.error(`Invalid YouTube URL provided: ${url}`);
            throw new MediaNotFoundError('Invalid YouTube URL');
        }

        const httpClient = new HttpClient(config);
        const videoId = this.extractVideoId(url);
        logger.info(`Extracted video ID: ${videoId}`);

        let cookies: string[];
        try {
            cookies = await this.fetchCookies();
            logger.info(`Fetched cookies: ${JSON.stringify(cookies)}`);
        } catch (error) {
            logger.error(`Error fetching cookies: ${error}`);
            throw new MediaNotFoundError('Failed to fetch necessary cookies');
        }

        let analysisData: any;
        try {
            analysisData = await this.analyzeVideo(httpClient, videoId, cookies);
            logger.info(`Analysis data received: ${JSON.stringify(analysisData)}`);
        } catch (error) {
            logger.error(`Error analyzing video: ${error}`);
            throw new MediaNotFoundError('Failed to analyze video information');
        }

        if (!analysisData || !analysisData.links) {
            logger.error('No analysis data or links found.');
            throw new MediaNotFoundError('Failed to retrieve video information');
        }

        logger.info('Calling getMediaUrls with analysis data...');
        let mediaUrls: any[];
        try {
            mediaUrls = await this.getMediaUrls(
                httpClient,
                videoId,
                analysisData,
                options,
                cookies
            );
            logger.info(`Media URLs retrieved: ${JSON.stringify(mediaUrls)}`);
        } catch (error) {
            logger.error(`Error getting media URLs: ${error}`);
            throw new MediaNotFoundError('Failed to retrieve media URLs');
        }

        let localPath: string | undefined;
        if (options.downloadMedia && mediaUrls.length > 0) {
            const fileName = this.generateFileName(
                analysisData.title,
                mediaUrls[0].format
            );
            logger.info(`Generated file name: ${fileName}`);

            try {
                localPath = await downloadFile(
                    mediaUrls[0].url,
                    config.downloadDir || './downloads',
                    fileName,
                    config
                );
                logger.info(`File downloaded to: ${localPath}`);
            } catch (error) {
                logger.error(`Error downloading file: ${error}`);
                // Depending on requirements, you might want to throw an error here
            }
        } else {
            logger.info(
                `Download media option is ${
                    options.downloadMedia ? 'enabled' : 'disabled'
                } or no media URLs available.`
            );
        }

        const mediaInfo: MediaInfo = {
            urls: mediaUrls,
            localPath,
            metadata: {
                title: analysisData.title,
                author: analysisData.author || 'Unknown',
                platform: 'YouTube',
                views: analysisData.views,
                likes: analysisData.likes,
            },
        };

        logger.info(`Returning MediaInfo: ${JSON.stringify(mediaInfo)}`);
        return mediaInfo;
    }

    /**
     * Fetches cookies from y2mate.com
     * @returns A promise that resolves to an array of cookie strings.
     */
    private async fetchCookies(): Promise<string[]> {
        logger.info('Fetching cookies from https://www.y2mate.com/en872');

        return new Promise((resolve, reject) => {
            const req = https.get('https://www.y2mate.com/en872', res => {
                const cookiesArray = res.headers['set-cookie'];
                if (cookiesArray) {
                    logger.info(`Cookies fetched: ${JSON.stringify(cookiesArray)}`);
                    resolve(cookiesArray);
                } else {
                    logger.warn(
                        'No cookies found in response headers. Using default cookies.'
                    );
                    resolve([
                        '_gid=GA1.2.2055666962.1683248123',
                        '_ga=GA1.1.1570308475.1683248122',
                        '_ga_K8CD7CY0TZ=GS1.1.1683248122.1.1.1683248164.0.0.0',
                        'prefetchAd_3381349=true',
                    ]);
                }
            });

            req.on('error', e => {
                logger.error(`HTTP request error while fetching cookies: ${e.message}`);
                reject(new Error(`Failed to fetch cookies: ${e.message}`));
            });

            req.setTimeout(this.DEFAULT_TIMEOUT, () => {
                req.destroy();
                logger.error('Request to fetch cookies timed out.');
                reject(new Error('Request to fetch cookies timed out'));
            });
        });
    }

    /**
     * Analyzes the video using y2mate's analyze endpoint.
     * @param httpClient - The HTTP client instance.
     * @param videoId - The YouTube video ID.
     * @param cookies - Array of cookies to include in the request.
     * @returns A promise that resolves to the analysis data.
     */
    private async analyzeVideo(
        httpClient: HttpClient,
        videoId: string,
        cookies: string[]
    ) {
        logger.info(`Analyzing video with ID: ${videoId}`);

        const postData = new URLSearchParams({
            vid: videoId,
            k_query: `${this.VIDEO_URL_BASE}${videoId}`,
            k_page: 'home',
            hl: 'en',
            q_auto: '0',
        }).toString();

        logger.info(`Post data for analysis: ${postData}`);

        const response = await httpClient.post(
            `${this.API_BASE_URL}/analyzeV2/ajax`,
            postData,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Cookie: cookies.join('; '),
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                        '(KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                },
            }
        );

        logger.info(`Analysis response data: ${JSON.stringify(response.data)}`);
        return response.data;
    }

    /**
     * Retrieves media URLs based on analysis data.
     * @param httpClient - The HTTP client instance.
     * @param videoId - The YouTube video ID.
     * @param analysisData - Data obtained from analyzing the video.
     * @param options - Download options.
     * @param cookies - Array of cookies to include in the requests.
     * @returns A promise that resolves to an array of media URLs.
     */
    private async getMediaUrls(
        httpClient: HttpClient,
        videoId: string,
        analysisData: any,
        options: Required<DownloadOptions>,
        cookies: string[]
    ) {
        logger.info('Entering getMediaUrls method.');
        const mediaUrls: any[] = [];
        const formats = options.preferAudio ? ['mp3'] : ['mp4', 'mp3'];
        logger.info(`Formats to process: ${formats.join(', ')}`);

        for (const format of formats) {
            logger.info(`Processing format: ${format}`);
            if (analysisData.links[format]) {
                logger.info(`Found links for format: ${format}`);
                for (const key in analysisData.links[format]) {
                    const item = analysisData.links[format][key];
                    logger.info(`Processing item: ${JSON.stringify(item)}`);

                    if (this.isQualityAcceptable(item.q, options.quality)) {
                        logger.info(
                            `Item quality "${item.q}" is acceptable for requested quality "${options.quality}".`
                        );
                        try {
                            logger.info(
                                `Attempting to convert media with key: ${item.k}`
                            );
                            const convertResponse = await this.convertMedia(
                                httpClient,
                                videoId,
                                item.k,
                                cookies
                            );
                            logger.info(
                                `Convert response: ${JSON.stringify(convertResponse)}`
                            );

                            if (convertResponse.dlink) {
                                mediaUrls.push({
                                    url: convertResponse.dlink,
                                    quality: item.q,
                                    format: format,
                                    size: parseFloat(convertResponse.size) || 0,
                                });
                                logger.info(`Added media URL: ${convertResponse.dlink}`);

                                if (options.preferAudio) {
                                    logger.info(
                                        'Prefer audio option is set. Returning early with available media URL.'
                                    );
                                    return mediaUrls;
                                }
                            } else {
                                logger.warn(
                                    'No download link found in convert response.'
                                );
                            }
                        } catch (error) {
                            logger.error(
                                `Failed to convert media with key ${item.k}: ${error}`
                            );
                        }
                    } else {
                        logger.warn(
                            `Item quality "${item.q}" is not acceptable for requested quality "${options.quality}".`
                        );
                    }
                }
            } else {
                logger.warn(`No links found for format: ${format}`);
            }
        }

        logger.info(
            `Finished processing formats. Total media URLs found: ${mediaUrls.length}`
        );
        return mediaUrls;
    }

    /**
     * Converts media using y2mate's convert endpoint.
     * @param httpClient - The HTTP client instance.
     * @param videoId - The YouTube video ID.
     * @param key - The key for conversion.
     * @param cookies - Array of cookies to include in the request.
     * @returns A promise that resolves to the conversion response data.
     */
    private async convertMedia(
        httpClient: HttpClient,
        videoId: string,
        key: string,
        cookies: string[]
    ) {
        logger.info(`Converting media for video ID: ${videoId} with key: ${key}`);

        const postData = new URLSearchParams({
            vid: videoId,
            k: key,
        }).toString();

        logger.info(`Post data for conversion: ${postData}`);

        const response = await httpClient.post(
            `${this.API_BASE_URL}/en948/convertV2/index`,
            postData,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Cookie: cookies.join('; '),
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                        '(KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                },
            }
        );

        logger.info(`ConvertMedia response data: ${JSON.stringify(response.data)}`);
        return response.data;
    }

    /**
     * Checks if the item's quality meets the requested quality.
     * @param itemQuality - The quality of the media item.
     * @param requestedQuality - The quality preference set by the user.
     * @returns True if acceptable, else false.
     */
    private isQualityAcceptable(itemQuality: string, requestedQuality: string): boolean {
        logger.info(
            `Checking if item quality "${itemQuality}" meets requested quality "${requestedQuality}"`
        );

        if (requestedQuality === 'highest') {
            logger.info(`Requested quality is "highest". Any quality is acceptable.`);
            return true;
        }

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

        const itemQualityValue = qualityMap[itemQuality] || 0;
        const requestedQualityValue = qualityMap[requestedQuality] || Infinity;

        const isAcceptable = itemQualityValue <= requestedQualityValue;
        logger.info(
            `Item quality value: ${itemQualityValue}, Requested quality value: ${requestedQualityValue}. Acceptable: ${isAcceptable}`
        );

        return isAcceptable;
    }

    /**
     * Validates if the provided URL is a valid YouTube URL.
     * @param url - The URL to validate.
     * @returns True if valid, else false.
     */
    public isValidUrl(url: string): boolean {
        const isValid = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
        logger.info(`URL validation for "${url}": ${isValid}`);
        return isValid;
    }

    /**
     * Extracts the video ID from a YouTube URL.
     * @param url - The YouTube video URL.
     * @returns The extracted video ID.
     */
    private extractVideoId(url: string): string {
        logger.info(`Extracting video ID from URL: ${url}`);
        let videoId = '';
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === 'youtu.be') {
                videoId = urlObj.pathname.slice(1);
            } else {
                videoId = urlObj.searchParams.get('v') || '';
            }
            logger.info(`Extracted video ID: ${videoId}`);
        } catch (error) {
            logger.error(`Error extracting video ID from URL "${url}": ${error}`);
        }
        return videoId;
    }

    /**
     * Generates a sanitized file name based on the video title and format.
     * @param title - The title of the video.
     * @param format - The format of the media (e.g., mp3, mp4).
     * @returns A sanitized file name string.
     */
    private generateFileName(title: string, format: string): string {
        logger.info(
            `Generating file name from title: "${title}" and format: "${format}"`
        );
        const sanitizedTitle = title
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');
        const fileName = `${sanitizedTitle}.${format}`;
        logger.info(`Generated file name: ${fileName}`);
        return fileName;
    }
}

export default YouTubeHandler;
