import {PlatformHandler, DownloadOptions, MediaInfo, DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
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

        const cookies = this.getCookies();

        const analysisData = await this.analyzeVideo(videoId, cookies);
        const mediaUrls = await this.getMediaUrls(
            videoId,
            analysisData,
            options,
            cookies
        );

        let localPath: string | undefined;
        if (options.downloadMedia && mediaUrls.length > 0) {
            localPath = await this.downloadMedia(mediaUrls, analysisData.title, config);
        }

        return this.createMediaInfo(mediaUrls, localPath, analysisData);
    }

    private getCookies(): string[] {
        return [
            '_gid=GA1.2.2055666962.1683248123',
            '_ga=GA1.1.1570308475.1683248122',
            '_ga_K8CD7CY0TZ=GS1.1.1683248122.1.1.1683248164.0.0.0',
            'prefetchAd_3381349=true',
        ];
    }

    private async analyzeVideo(videoId: string, cookies: string[]): Promise<any> {
        const postData = new URLSearchParams({
            vid: videoId,
            k_query: `${this.VIDEO_URL_BASE}${videoId}`,
            k_page: 'home',
            hl: 'en',
            q_auto: '0',
        }).toString();

        try {
            const response = await this.httpClient.post(
                `${this.API_BASE_URL}/analyzeV2/ajax`,
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
        cookies: string[]
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
                        cookies
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
        cookies: string[]
    ): Promise<any> {
        const postData = new URLSearchParams({vid: videoId, k: key}).toString();
        try {
            const response = await this.httpClient.post(
                `${this.API_BASE_URL}/convertV2/index`,
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

    private getHeaders(cookies: string[]): Record<string, string> {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookies.join('; '),
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        };
    }

    private async downloadMedia(
        mediaUrls: any[],
        title: string,
        config: DownloaderConfig
    ): Promise<string | undefined> {
        const selectedMedia =
            mediaUrls.find(urlInfo => urlInfo.format === 'mp4') || mediaUrls[0];
        const fileName = this.generateFileName(title, selectedMedia.format);
        try {
            return await this.fileDownloader.downloadFile(
                selectedMedia.url,
                config.downloadDir,
                fileName
            );
        } catch (error) {
            logger.error(`Error downloading file: ${error}`);
            return undefined;
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
        return {url, quality: item.q, format, size: sizeMB};
    }

    private createMediaInfo(
        mediaUrls: any[],
        localPath: string | undefined,
        analysisData: any
    ): MediaInfo {
        return {
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
    }
}

export default YouTubeHandler;
