import {PlatformHandler, DownloadOptions, MediaInfo, DownloaderConfig} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {downloadFile} from '@/utils/file-downloader';
import logger from '@/utils/logger';
import {MediaNotFoundError} from '@/types/errors';

class YouTubeHandler implements PlatformHandler {
    private readonly API_BASE_URL = 'https://www.y2mate.com/mates';
    private readonly VIDEO_URL_BASE = 'https://www.youtube.com/watch?v=';

    async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        if (!this.isValidUrl(url)) {
            throw new MediaNotFoundError('Invalid YouTube URL');
        }

        const httpClient = new HttpClient(config);
        const videoId = this.extractVideoId(url);
        const analysisData = await this.analyzeVideo(httpClient, videoId);

        if (!analysisData || !analysisData.links) {
            throw new MediaNotFoundError('Failed to retrieve video information');
        }

        const mediaUrls = await this.getMediaUrls(
            httpClient,
            videoId,
            analysisData,
            options
        );
        let localPath: string | undefined;

        if (options.downloadMedia && mediaUrls.length > 0) {
            const fileName = this.generateFileName(
                analysisData.title,
                mediaUrls[0].format
            );
            localPath = await downloadFile(
                mediaUrls[0].url,
                config.downloadDir || './downloads',
                fileName,
                config
            );
        }

        return {
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
    }

    private async analyzeVideo(httpClient: HttpClient, videoId: string) {
        const postData = new URLSearchParams({
            vid: videoId,
            k_query: `${this.VIDEO_URL_BASE}${videoId}`,
            k_page: 'home',
            hl: 'en',
            q_auto: '0',
        }).toString();

        const response = await httpClient.post(
            `${this.API_BASE_URL}/analyzeV2/ajax`,
            postData,
            {
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            }
        );

        return response.data;
    }

    private async getMediaUrls(
        httpClient: HttpClient,
        videoId: string,
        analysisData: any,
        options: Required<DownloadOptions>
    ) {
        const mediaUrls = [];
        const formats = options.preferAudio ? ['mp3'] : ['mp4', 'mp3'];

        for (const format of formats) {
            if (analysisData.links[format]) {
                for (const key in analysisData.links[format]) {
                    const item = analysisData.links[format][key];
                    if (this.isQualityAcceptable(item.q, options.quality)) {
                        try {
                            const convertResponse = await this.convertMedia(
                                httpClient,
                                videoId,
                                item.k
                            );
                            if (convertResponse.dlink) {
                                mediaUrls.push({
                                    url: convertResponse.dlink,
                                    quality: item.q,
                                    format: format,
                                    size: parseFloat(convertResponse.size) || 0,
                                });
                                if (options.preferAudio) return mediaUrls;
                            }
                        } catch (error) {
                            logger(`Failed to convert media: ${error}`);
                        }
                    }
                }
            }
        }

        return mediaUrls;
    }

    private async convertMedia(httpClient: HttpClient, videoId: string, key: string) {
        const postData = new URLSearchParams({vid: videoId, k: key}).toString();
        const response = await httpClient.post(
            `${this.API_BASE_URL}/convertV2/index`,
            postData,
            {
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            }
        );
        return response.data;
    }

    private isQualityAcceptable(itemQuality: string, requestedQuality: string): boolean {
        if (requestedQuality === 'highest') return true;
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
        return (
            (qualityMap[itemQuality] || 0) <= (qualityMap[requestedQuality] || Infinity)
        );
    }

    public isValidUrl(url: string): boolean {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
    }

    private extractVideoId(url: string): string {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        return urlObj.searchParams.get('v') || '';
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
