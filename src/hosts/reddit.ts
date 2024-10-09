import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import {MediaNotFoundError} from '@/types/errors';
import logger from '@/utils/logger';

export default class RedditHandler implements PlatformHandler {
    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {}

    public isValidUrl(url: string): boolean {
        return /^https?:\/\/(www\.)?(reddit\.com|redd\.it)\/.+/i.test(url);
    }

    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const jsonUrl = this.convertToJsonUrl(url);
            const response = await this.httpClient.get<any[]>(jsonUrl);
            const postData = this.extractPostData(response.data);

            const mediaInfo: MediaInfo = {
                urls: [],
                metadata: this.extractMetadata(postData),
            };

            const mediaUrls = this.processRedditPost(postData);
            if (!mediaUrls.length) {
                throw new MediaNotFoundError('No media found in the Reddit post.');
            }

            mediaInfo.urls = await this.populateMediaUrls(mediaUrls, options, config);

            return mediaInfo;
        } catch (error: any) {
            logger.error(`Error fetching media info from Reddit: ${error.message}`);
            if (error instanceof MediaNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to fetch media info from Reddit: ${error.message}`);
        }
    }

    private convertToJsonUrl(url: string): string {
        const urlObj = new URL(url);
        urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '.json';
        return urlObj.toString();
    }

    private extractPostData(apiResponse: any[]): any {
        if (apiResponse?.[0]?.data?.children?.[0]?.data) {
            return apiResponse[0].data.children[0].data;
        }
        throw new Error('Unexpected response structure from Reddit API.');
    }

    private extractMetadata(postData: any): MediaInfo['metadata'] {
        return {
            title: postData.title,
            author: postData.author,
            platform: 'Reddit',
            views: postData.view_count || undefined,
            likes: postData.score || undefined,
        };
    }

    private processRedditPost(postData: any): string[] {
        const mediaUrls: string[] = [];

        if (postData.is_gallery && postData.gallery_data?.items) {
            mediaUrls.push(...this.processGallery(postData));
        } else if (postData.is_video && postData.media?.reddit_video?.fallback_url) {
            mediaUrls.push(postData.media.reddit_video.fallback_url);
        } else if (postData.url && this.isDirectMediaUrl(postData.url)) {
            mediaUrls.push(postData.url);
        } else if (
            postData.url_overridden_by_dest &&
            this.isDirectMediaUrl(postData.url_overridden_by_dest)
        ) {
            mediaUrls.push(postData.url_overridden_by_dest);
        } else if (postData.preview?.images?.[0]?.source?.url) {
            const imageUrl = postData.preview.images[0].source.url.replace(/&amp;/g, '&');
            mediaUrls.push(imageUrl);
        }

        return mediaUrls;
    }

    private processGallery(postData: any): string[] {
        return postData.gallery_data.items.map((item: any) => {
            const mediaId = item.media_id;
            const mimeType = postData.media_metadata[mediaId]?.m || 'image/jpeg';
            const extension = this.getExtensionFromMimeType(mimeType);
            return `https://i.redd.it/${mediaId}.${extension}`;
        });
    }

    private isDirectMediaUrl(url: string): boolean {
        return /\.(jpg|jpeg|png|gif|mp4|mkv|webm)$/i.test(url);
    }

    private getFormatFromUrl(url: string): string {
        const extensionMatch = url.match(/\.(\w+)(?:\?|$)/);
        return extensionMatch ? extensionMatch[1].toLowerCase() : 'unknown';
    }

    private getExtensionFromMimeType(mimeType: string): string {
        const mimeToExt: {[key: string]: string} = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
        };
        return mimeToExt[mimeType] || 'jpg';
    }

    private async populateMediaUrls(
        mediaUrls: string[],
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo['urls']> {
        const populatedUrls: MediaInfo['urls'] = [];

        for (const mediaUrl of mediaUrls) {
            const format = this.getFormatFromUrl(mediaUrl);
            const quality = format.startsWith('video')
                ? this.getVideoQuality(mediaUrl)
                : 'original';

            const urlInfo: MediaInfo['urls'][number] = {
                url: mediaUrl,
                quality,
                format,
                size: await this.getFileSize(mediaUrl),
            };

            if (options.downloadMedia) {
                const fileName = `reddit_${Date.now()}.${format}`;
                const localPath = await this.fileDownloader.downloadFile(
                    mediaUrl,
                    config.downloadDir,
                    fileName
                );
                urlInfo.localPath = localPath;
            }

            populatedUrls.push(urlInfo);
        }

        return populatedUrls;
    }

    private getVideoQuality(url: string): string {
        const qualityMatch = url.match(/DASH_(\d+)/);
        return qualityMatch ? `${qualityMatch[1]}p` : 'unknown';
    }

    private async getFileSize(url: string): Promise<number> {
        try {
            const response = await this.httpClient.get(url, {method: 'HEAD'});
            return (
                parseInt(response.headers['content-length'] || '0', 10) / (1024 * 1024)
            );
        } catch (error) {
            logger.warn(`Failed to get file size for ${url}: ${error}`);
            return 0;
        }
    }
}
