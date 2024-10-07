import {PlatformHandler, DownloadOptions, DownloaderConfig, MediaInfo} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import {MediaNotFoundError, DownloadError} from '@/types/errors';
import logger from '@/utils/logger';

class FacebookHandler implements PlatformHandler {
    private static validUrlPattern = /^(https?:\/\/)?(www\.)?(facebook|fb).com\/.+/i;
    private readonly apiUrl: string;

    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {
        this.apiUrl = 'https://172.67.222.44/api/ajaxSearch/facebook';
    }

    public isValidUrl(url: string): boolean {
        return FacebookHandler.validUrlPattern.test(url);
    }

    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        try {
            const postData = `q=${encodeURIComponent(url)}`;

            const response = await this.httpClient.post(this.apiUrl, postData, {
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

            const urls = this.extractMediaUrls(data, options.quality);

            if (urls.length === 0) {
                throw new MediaNotFoundError('No downloadable video found.');
            }

            const mediaInfo: MediaInfo = {
                urls: urls,
                metadata: {
                    title: data.title || 'Facebook Video',
                    author: data.author || 'Unknown',
                    platform: 'Facebook',
                },
            };

            if (options.downloadMedia) {
                const mediaUrl = mediaInfo.urls[0].url;
                const fileExtension = mediaInfo.urls[0].format;
                const sanitizedTitle = mediaInfo.metadata.title
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '_');
                const fileName = `${sanitizedTitle}-${Date.now()}.${fileExtension}`;

                const localPath = await this.fileDownloader.downloadFile(
                    mediaUrl,
                    config.downloadDir || './downloads',
                    fileName
                );
                mediaInfo.localPath = localPath;
            }

            return mediaInfo;
        } catch (error: any) {
            if (error instanceof MediaNotFoundError) {
                throw error;
            } else {
                logger.error(
                    `An error occurred while fetching media info: ${error.message}`
                );
                throw new DownloadError('Failed to download media.');
            }
        }
    }

    private extractMediaUrls(data: any, quality: string): Array<MediaInfo['urls'][0]> {
        const urls = [];
        const desiredQuality = quality.toLowerCase();

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
