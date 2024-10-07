import {PlatformHandler, DownloadOptions, DownloaderConfig, MediaInfo} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {MediaNotFoundError, DownloadError} from '@/types/errors';
import logger from '@/utils/logger';
import {downloadFile} from '@/utils/file-downloader';

class FacebookHandler implements PlatformHandler {
    private static validUrlPattern = /^(https?:\/\/)?(www\.)?(facebook|fb).com\/.+/i;

    private readonly apiUrl: string;

    constructor() {
        this.apiUrl = 'https://172.67.222.44/api/ajaxSearch/facebook';
    }

    /**
     * Validates if the given URL is a Facebook video URL.
     * @param url The media URL.
     * @returns True if the URL is a valid Facebook video URL.
     */
    public isValidUrl(url: string): boolean {
        return FacebookHandler.validUrlPattern.test(url);
    }

    /**
     * Fetches media information for a Facebook video.
     * @param url The Facebook video URL.
     * @param options Download options.
     * @param config Downloader configuration.
     * @returns MediaInfo object containing URLs and metadata.
     */
    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const httpClient = new HttpClient(config);

            const postData = `q=${encodeURIComponent(url)}`;

            const response = await httpClient.post(this.apiUrl, postData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                        '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                },
            });

            const data = response.data;

            if (!data || data.status !== 'ok') {
                throw new MediaNotFoundError(
                    'Media not found or platform not supported.'
                );
            }

            // Extract media URLs based on desired quality
            const urls = this.extractMediaUrls(data, options.quality);

            if (urls.length === 0) {
                throw new MediaNotFoundError('No downloadable video found.');
            }

            // Prepare MediaInfo object
            const mediaInfo: MediaInfo = {
                urls: urls,
                metadata: {
                    title: data.title || 'Facebook Video',
                    author: data.author || 'Unknown',
                    platform: 'Facebook',
                },
            };

            if (options.downloadMedia) {
                // Download the first available media URL
                const mediaUrl = mediaInfo.urls[0].url;
                const fileExtension = mediaInfo.urls[0].format;
                const sanitizedTitle = mediaInfo.metadata.title
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '_');
                const fileName = `${sanitizedTitle}-${Date.now()}.${fileExtension}`;

                const localPath = await downloadFile(
                    mediaUrl,
                    config.downloadDir || './downloads',
                    fileName,
                    config
                );
                mediaInfo.localPath = localPath;
            }

            return mediaInfo;
        } catch (error: any) {
            // Handle known errors
            if (error instanceof MediaNotFoundError) {
                throw error;
            } else {
                logger(`An error occurred while fetching media info: ${error.message}`);
                throw new DownloadError('Failed to download media.');
            }
        }
    }

    /**
     * Extracts media URLs from the API response based on the desired quality.
     * @param data API response data.
     * @param quality Desired quality string.
     * @returns An array of media URLs with their quality and format.
     */
    private extractMediaUrls(data: any, quality: string): Array<MediaInfo['urls'][0]> {
        const urls = [];

        const desiredQuality = quality.toLowerCase();

        // Mapping desired quality to available qualities
        if (['highest', 'hd', 'high', '720p', '1080p'].includes(desiredQuality)) {
            if (data.links?.hd) {
                urls.push({
                    url: data.links.hd,
                    quality: 'HD',
                    format: 'mp4',
                    size: 0,
                });
            }
        }

        if (['lowest', 'sd', 'low', '480p', '360p'].includes(desiredQuality)) {
            if (data.links?.sd) {
                urls.push({
                    url: data.links.sd,
                    quality: 'SD',
                    format: 'mp4',
                    size: 0,
                });
            }
        }

        // If no specific quality is found, include all available qualities
        if (urls.length === 0) {
            if (data.links?.hd) {
                urls.push({
                    url: data.links.hd,
                    quality: 'HD',
                    format: 'mp4',
                    size: 0,
                });
            }
            if (data.links?.sd) {
                urls.push({
                    url: data.links.sd,
                    quality: 'SD',
                    format: 'mp4',
                    size: 0,
                });
            }
        }

        return urls;
    }
}

export default FacebookHandler;
