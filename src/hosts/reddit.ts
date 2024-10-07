import {DownloaderConfig, DownloadOptions, MediaInfo, PlatformHandler} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {MediaNotFoundError} from '@/types/errors';
import logger from '@/utils/logger';

export default class RedditHandler implements PlatformHandler {
    private readonly HTTP_CLIENT: HttpClient;

    constructor() {
        this.HTTP_CLIENT = new HttpClient({});
    }

    /**
     * Checks if the provided URL is a valid Reddit URL.
     * @param url The media URL.
     * @returns Boolean indicating if the URL is valid for this handler.
     */
    public isValidUrl(url: string): boolean {
        return /^https?:\/\/(www\.)?reddit\.com\/.+/i.test(url);
    }

    /**
     * Fetches media information from a Reddit post URL.
     * @param url The Reddit post URL.
     * @param options Download options.
     * @param config Downloader configuration.
     * @returns MediaInfo object containing media URLs and metadata.
     */
    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const jsonUrl = this.convertToJsonUrl(url);
            const response = await this.HTTP_CLIENT.get<any[]>(jsonUrl);
            const postData = this.extractPostData(response.data);

            const mediaInfo: MediaInfo = {
                urls: [],
                metadata: {
                    title: postData.title,
                    author: postData.author,
                    platform: 'Reddit',
                    views: postData.view_count || undefined,
                    likes: postData.score || undefined,
                },
            };

            // Process media URLs
            const mediaUrls = this.processRedditPost(postData);
            if (!mediaUrls.length) {
                throw new MediaNotFoundError('No media found in the Reddit post.');
            }

            // Populate media URLs with additional info
            for (const mediaUrl of mediaUrls) {
                mediaInfo.urls.push({
                    url: mediaUrl,
                    quality: 'unknown',
                    format: this.getFormatFromUrl(mediaUrl),
                    size: 0, // Size can be fetched if necessary
                });
            }

            // Download media if required
            if (options.downloadMedia) {
                // Implement the download logic using your existing utilities
                // E.g., mediaInfo.localPath = await downloadFile(...);
            }

            return mediaInfo;
        } catch (error: any) {
            logger.error(`Error fetching media info from Reddit: ${error.message}`);
            if (error instanceof MediaNotFoundError) {
                throw error;
            }
            throw new Error(`Failed to fetch media info from Reddit: ${error.message}`);
        }
    }

    /**
     * Converts a Reddit post URL to its corresponding JSON URL.
     * @param url The Reddit post URL.
     * @returns The JSON URL.
     */
    private convertToJsonUrl(url: string): string {
        let jsonUrl = url;
        if (!jsonUrl.endsWith('.json')) {
            jsonUrl = jsonUrl.replace(/\/$/, '') + '.json';
        }
        return jsonUrl;
    }

    /**
     * Extracts the post data from the Reddit API response.
     * @param apiResponse The Reddit API response data.
     * @returns The Reddit post data.
     */
    private extractPostData(apiResponse: any[]): any {
        if (apiResponse?.[0]?.data?.children?.[0]?.data) {
            return apiResponse[0].data.children[0].data;
        }
        throw new Error('Unexpected response structure from Reddit API.');
    }

    /**
     * Processes the Reddit post data to extract media URLs.
     * @param postData The Reddit post data.
     * @returns Array of media URLs.
     */
    private processRedditPost(postData: any): string[] {
        const mediaUrls: string[] = [];

        if (postData.is_gallery && postData.gallery_data?.items) {
            // Handle Reddit galleries
            const galleryUrls = postData.gallery_data.items.map((item: any) => {
                const mediaId = item.media_id;
                const mimeType = postData.media_metadata[mediaId]?.m || 'image/jpeg';
                const extension = this.getExtensionFromMimeType(mimeType);
                return `https://i.redd.it/${mediaId}.${extension}`;
            });
            mediaUrls.push(...galleryUrls);
        } else if (postData.is_video && postData.media?.reddit_video?.fallback_url) {
            // Handle Reddit native videos
            mediaUrls.push(postData.media.reddit_video.fallback_url);
        } else if (postData.url && this.isDirectMediaUrl(postData.url)) {
            // Handle direct media URLs
            mediaUrls.push(postData.url);
        } else if (
            postData.url_overridden_by_dest &&
            this.isDirectMediaUrl(postData.url_overridden_by_dest)
        ) {
            // Handle overridden media URLs
            mediaUrls.push(postData.url_overridden_by_dest);
        } else if (postData.preview?.images?.[0]?.source?.url) {
            // Handle preview images
            const imageUrl = postData.preview.images[0].source.url.replace(/&amp;/g, '&');
            mediaUrls.push(imageUrl);
        }

        return mediaUrls;
    }

    /**
     * Determines if a URL is a direct link to a media file.
     * @param url The URL to check.
     * @returns Boolean indicating if the URL is a direct media link.
     */
    private isDirectMediaUrl(url: string): boolean {
        return /\.(jpg|jpeg|png|gif|mp4|mkv|webm)$/i.test(url);
    }

    /**
     * Extracts the file format from a URL.
     * @param url The media URL.
     * @returns The file format as a string.
     */
    private getFormatFromUrl(url: string): string {
        const extensionMatch = url.match(/\.(\w+)(?:\?|$)/);
        return extensionMatch ? extensionMatch[1] : 'unknown';
    }

    /**
     * Gets the file extension based on MIME type.
     * @param mimeType The MIME type.
     * @returns The file extension.
     */
    private getExtensionFromMimeType(mimeType: string): string {
        const mimeToExt: {[key: string]: string} = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'video/mp4': 'mp4',
        };
        return mimeToExt[mimeType] || 'jpg';
    }
}
