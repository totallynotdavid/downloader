import {PlatformHandler, DownloadOptions, MediaInfo, DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {downloadFile} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import {MediaNotFoundError} from '@/types/errors';

class YouTubeHandler implements PlatformHandler {
    private readonly API_BASE_URL = 'https://www.y2mate.com/mates';
    private readonly VIDEO_URL_BASE = 'https://www.youtube.com/watch?v=';

    private readonly qualityMap: Record<string, number> = {
        auto: 0,
        '144p': 1,
        '240p': 2,
        '360p': 3,
        '480p': 4,
        '720p': 5,
        '1080p': 6,
        '1440p': 7,
        '2160p': 8,
    };

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

        const cookies = [
            '_gid=GA1.2.2055666962.1683248123',
            '_ga=GA1.1.1570308475.1683248122',
            '_ga_K8CD7CY0TZ=GS1.1.1683248122.1.1.1683248164.0.0.0',
            'prefetchAd_3381349=true',
        ];

        let analysisData: any;
        try {
            analysisData = await this.analyzeVideo(httpClient, videoId, cookies);
        } catch (error) {
            logger.error(`Error analyzing video: ${error}`);
            throw new MediaNotFoundError('Failed to analyze video information');
        }

        if (!analysisData || !analysisData.links) {
            logger.error('No analysis data or links found.');
            throw new MediaNotFoundError('Failed to retrieve video information');
        }

        let mediaUrls: any[];
        try {
            mediaUrls = await this.getMediaUrls(
                httpClient,
                videoId,
                analysisData,
                options,
                cookies
            );
        } catch (error) {
            logger.error(`Error getting media URLs: ${error}`);
            throw new MediaNotFoundError('Failed to retrieve media URLs');
        }

        let localPath: string | undefined;
        if (options.downloadMedia && mediaUrls.length > 0) {
            const selectedMedia =
                mediaUrls.find(urlInfo => urlInfo.format === 'mp4') || mediaUrls[0];
            const fileName = this.generateFileName(
                analysisData.title,
                selectedMedia.format
            );

            try {
                localPath = await downloadFile(
                    selectedMedia.url,
                    config.downloadDir || './downloads',
                    fileName,
                    config
                );
            } catch (error) {
                logger.error(`Error downloading file: ${error}`);
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
                author: analysisData.author,
                platform: 'YouTube',
                views: analysisData.views,
                likes: analysisData.likes,
            },
        };

        return mediaInfo;
    }

    private async analyzeVideo(
        httpClient: HttpClient,
        videoId: string,
        cookies: string[]
    ) {
        const postData = new URLSearchParams({
            vid: videoId,
            k_query: `${this.VIDEO_URL_BASE}${videoId}`,
            k_page: 'home',
            hl: 'en',
            q_auto: '0',
        }).toString();

        try {
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
            logger.debug(
                'Analyze video response:',
                JSON.stringify(response.data, null, 2)
            );
            return response.data;
        } catch (error: any) {
            if (error.response) {
                logger.error(
                    `POST request failed for ${error.config.url}: Request failed with status code ${error.response.status}`
                );
            } else {
                logger.error(
                    `POST request failed for ${this.API_BASE_URL}/analyzeV2/ajax: ${error.message}`
                );
            }
            throw error;
        }
    }

    private async getMediaUrls(
        httpClient: HttpClient,
        videoId: string,
        analysisData: any,
        options: Required<DownloadOptions>,
        cookies: string[]
    ) {
        const mediaUrls: any[] = [];
        const formats = options.preferAudio ? ['mp3'] : ['mp4'];

        for (const format of formats) {
            if (analysisData.links[format]) {
                const bestItem = this.getBestQualityItem(
                    analysisData.links[format],
                    options.quality
                );
                if (bestItem) {
                    try {
                        const convertResponse = await this.convertMedia(
                            httpClient,
                            videoId,
                            bestItem.k,
                            cookies
                        );

                        if (convertResponse.dlink) {
                            let sizeMB = 0;
                            if (convertResponse.size) {
                                const sizeMatch =
                                    convertResponse.size.match(/([\d.]+)\s*MB/i);
                                if (sizeMatch) {
                                    sizeMB = parseFloat(sizeMatch[1]);
                                }
                            }

                            mediaUrls.push({
                                url: convertResponse.dlink,
                                quality: bestItem.q,
                                format: format,
                                size: sizeMB,
                            });

                            if (options.preferAudio) {
                                return mediaUrls;
                            }
                        } else {
                            logger.warn('No download link found in convert response.');
                        }
                    } catch (error) {
                        logger.error(
                            `Failed to convert media with key ${bestItem.k}: ${error}`
                        );
                    }
                } else {
                    logger.warn(`No suitable item found for format: ${format}`);
                }
            } else {
                logger.warn(`No links found for format: ${format}`);
            }
        }

        return mediaUrls;
    }

    private async convertMedia(
        httpClient: HttpClient,
        videoId: string,
        key: string,
        cookies: string[]
    ) {
        const postData = new URLSearchParams({
            vid: videoId,
            k: key,
        }).toString();

        try {
            const response = await httpClient.post(
                `${this.API_BASE_URL}/convertV2/index`,
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

            return response.data;
        } catch (error: any) {
            if (error.response) {
                logger.error(
                    `POST request failed for ${error.config.url}: Request failed with status code ${error.response.status}`
                );
            } else {
                logger.error(
                    `POST request failed for ${this.API_BASE_URL}/convertV2/index: ${error.message}`
                );
            }
            throw error;
        }
    }

    private getBestQualityItem(
        links: Record<string, any>,
        requestedQuality: string
    ): any | null {
        let bestItem: any = null;
        let highestQualityValue = -1;

        for (const key in links) {
            const item = links[key];
            const itemQuality = item.q;
            const itemQualityValue = this.qualityMap[itemQuality] || 0;

            if (this.isQualityAcceptable(itemQuality, requestedQuality)) {
                if (itemQualityValue > highestQualityValue) {
                    highestQualityValue = itemQualityValue;
                    bestItem = item;
                }
            }
        }

        return bestItem;
    }

    private isQualityAcceptable(itemQuality: string, requestedQuality: string): boolean {
        if (requestedQuality === 'highest') {
            return true;
        }

        const itemQualityValue = this.qualityMap[itemQuality] || 0;
        const requestedQualityValue = this.qualityMap[requestedQuality] || Infinity;

        return itemQualityValue <= requestedQualityValue;
    }

    public isValidUrl(url: string): boolean {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
    }

    private extractVideoId(url: string): string {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === 'youtu.be') {
                return urlObj.pathname.slice(1);
            } else {
                return urlObj.searchParams.get('v') || '';
            }
        } catch (error) {
            logger.error(`Error extracting video ID from URL "${url}": ${error}`);
            return '';
        }
    }

    private generateFileName(title: string, format: string): string {
        const sanitizedTitle = title
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');
        return `${sanitizedTitle}.${format}`;
    }
}

export default YouTubeHandler;
