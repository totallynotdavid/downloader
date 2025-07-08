import {PlatformHandler, DownloadOptions, MediaInfo, DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import {MediaNotFoundError} from '@/types/errors';

class YouTubeHandler implements PlatformHandler {
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

    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {}

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

        const videoId = this.extractVideoId(url);
        logger.info(`Extracted video ID: ${videoId}`);

        const apiBaseUrl = config.youtubeApiBaseUrl || 'https://www.y2mate.com/mates'; // Default for safety
        const cookies = config.youtubeCookies || '';

        if (!apiBaseUrl) {
            throw new Error('YouTube API base URL is not configured.');
        }

        const analysisData = await this.analyzeVideo(videoId, cookies, apiBaseUrl);
        const mediaUrls = await this.getMediaUrls(
            videoId,
            analysisData,
            options,
            cookies,
            apiBaseUrl
        );

        if (options.downloadMedia && mediaUrls.length > 0) {
            await this.downloadMediaFiles(mediaUrls, analysisData.title, config);
        }

        return this.createMediaInfo(mediaUrls, analysisData);
    }

    private async analyzeVideo(
        videoId: string,
        cookies: string,
        apiBaseUrl: string
    ): Promise<any> {
        const postData = new URLSearchParams({
            vid: videoId,
            k_query: `${this.VIDEO_URL_BASE}${videoId}`,
            k_page: 'home',
            hl: 'en',
            q_auto: '0',
        }).toString();

        try {
            const response = await this.httpClient.post(
                `${apiBaseUrl}/analyzeV2/ajax`,
                postData,
                {headers: this.getHeaders(cookies)}
            );
            return response.data;
        } catch (error) {
            logger.error(`Error analyzing video: ${error}`);
            throw new MediaNotFoundError('Failed to analyze video information');
        }
    }

    private async getMediaUrls(
        videoId: string,
        analysisData: any,
        options: Required<DownloadOptions>,
        cookies: string,
        apiBaseUrl: string
    ): Promise<any[]> {
        const mediaUrls: any[] = [];
        const formats = options.preferAudio ? ['mp3'] : ['mp4'];

        for (const format of formats) {
            if (analysisData.links[format]) {
                const bestItem = this.getBestQualityItem(
                    analysisData.links[format],
                    options.quality
                );
                if (bestItem) {
                    const convertResponse = await this.convertMedia(
                        videoId,
                        bestItem.k,
                        cookies,
                        apiBaseUrl
                    );
                    if (convertResponse.dlink) {
                        mediaUrls.push(
                            this.createMediaUrlInfo(
                                convertResponse.dlink,
                                bestItem,
                                format
                            )
                        );
                        if (options.preferAudio) return mediaUrls;
                    }
                }
            }
        }

        return mediaUrls;
    }

    private async convertMedia(
        videoId: string,
        key: string,
        cookies: string,
        apiBaseUrl: string
    ): Promise<any> {
        const postData = new URLSearchParams({vid: videoId, k: key}).toString();
        try {
            const response = await this.httpClient.post(
                `${apiBaseUrl}/convertV2/index`,
                postData,
                {headers: this.getHeaders(cookies)}
            );
            return response.data;
        } catch (error) {
            logger.error(`Failed to convert media with key ${key}: ${error}`);
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
            const itemQualityValue = this.qualityMap[item.q] || 0;

            if (
                this.isQualityAcceptable(item.q, requestedQuality) &&
                itemQualityValue > highestQualityValue
            ) {
                highestQualityValue = itemQualityValue;
                bestItem = item;
            }
        }

        return bestItem;
    }

    private isQualityAcceptable(itemQuality: string, requestedQuality: string): boolean {
        if (requestedQuality === 'highest') return true;
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
            return urlObj.hostname === 'youtu.be'
                ? urlObj.pathname.slice(1)
                : urlObj.searchParams.get('v') || '';
        } catch (error) {
            logger.error(`Error extracting video ID from URL "${url}": ${error}`);
            return '';
        }
    }

    private generateFileName(title: string, format: string): string {
        return `${title
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')}.${format}`;
    }

    private getHeaders(cookies: string): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        };
        if (cookies) {
            headers['Cookie'] = cookies;
        }
        return headers;
    }

    private async downloadMediaFiles(
        mediaUrls: any[],
        title: string,
        config: DownloaderConfig
    ): Promise<void> {
        for (const media of mediaUrls) {
            const fileName = this.generateFileName(title, media.format);
            try {
                const localPath = await this.fileDownloader.downloadFile(
                    media.url,
                    config.downloadDir,
                    fileName
                );
                media.localPath = localPath;
            } catch (error) {
                logger.error(`Error downloading file: ${error}`);
                media.localPath = undefined;
            }
        }
    }

    private createMediaUrlInfo(url: string, item: any, format: string): any {
        let sizeMB = 0;
        const sizeStr = item.size || '';
        if (sizeStr) {
            const sizeMatch = sizeStr.match(/([\d.]+)\s*(MB|KB)/i);
            if (sizeMatch) {
                sizeMB = parseFloat(sizeMatch[1]);
                if (sizeMatch[2].toLowerCase() === 'kb') {
                    sizeMB /= 1024;
                }
            }
        }
        return {url, quality: item.q, format, size: sizeMB, localPath: undefined};
    }

    private createMediaInfo(mediaUrls: any[], analysisData: any): MediaInfo {
        return {
            urls: mediaUrls,
            metadata: {
                title: analysisData.title,
                author: analysisData.a,
                platform: 'YouTube',
                views: analysisData.views,
                likes: analysisData.likes,
            },
        };
    }
}

export default YouTubeHandler;
