import {
    DownloaderConfig,
    DownloadOptions,
    MediaInfo,
    PlatformHandler,
    ImgurApiData,
    ImgurApiResponse,
    ImgurPostV1Response,
} from '@/types';
import {HttpClient} from '@/utils/http-client';
import {FileDownloader} from '@/utils/file-downloader';
import {MediaNotFoundError} from '@/types/errors';
import path from 'node:path';
import logger from '@/utils/logger';

export default class ImgurHandler implements PlatformHandler {
    private readonly clientId: string;

    constructor(
        private httpClient: HttpClient,
        private fileDownloader: FileDownloader
    ) {
        this.clientId = '546c25a59c58ad7';
    }

    public isValidUrl(url: string): boolean {
        const imgurRegex = /^https?:\/\/(www\.)?(i\.)?imgur\.com\/.+$/;
        return imgurRegex.test(url);
    }

    public async getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo> {
        const {type, id} = this.classifyImgurLink(url);
        const data = await this.fetchMediaInfo(type, id);

        if (!data) {
            throw new MediaNotFoundError('Media not found on Imgur.');
        }

        const mediaUrls = this.extractUrls(data);
        const metadata = this.extractMetadata(data);

        let urls: MediaInfo['urls'] = mediaUrls.map(mediaUrl => ({
            url: mediaUrl,
            quality: 'original',
            format: this.getFileExtension(mediaUrl),
            size: this.getSize(data, mediaUrl),
        }));

        if (options.downloadMedia) {
            urls = await this.downloadMedia(urls, config.downloadDir, metadata.title);
        }

        return {
            urls,
            metadata,
        };
    }

    private async downloadMedia(
        urls: MediaInfo['urls'],
        downloadDir: string,
        title: string
    ): Promise<MediaInfo['urls']> {
        return Promise.all(
            urls.map(async (urlInfo, index) => {
                const sanitizedTitle = title
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '_');
                const fileName = `${sanitizedTitle}_${index + 1}.${urlInfo.format}`;

                try {
                    const localPath = await this.fileDownloader.downloadFile(
                        urlInfo.url,
                        downloadDir,
                        fileName
                    );
                    return {...urlInfo, localPath};
                } catch (error) {
                    logger.error(`Failed to download file: ${error}`);
                    return urlInfo;
                }
            })
        );
    }

    private classifyImgurLink(url: string): {type: string; id: string} {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        let type: string;
        let id: string;

        if (urlObj.hostname.startsWith('i.')) {
            // Direct image link
            type = 'image';
            id = pathParts[0]?.split('.')[0] ?? '';
        } else if (pathParts[0] === 'gallery' || pathParts[0] === 'a') {
            // Gallery or album
            type = 'album';
            const lastPart = pathParts[pathParts.length - 1] ?? '';
            const parts = lastPart.split('-');
            id = parts[parts.length - 1] ?? '';
        } else {
            // Single image page
            type = 'image';
            id = pathParts[0] ?? '';
        }

        logger.info(`Classified Imgur link: type=${type}, id=${id}`);
        return {type, id};
    }

    private async fetchMediaInfo(
        type: string,
        id: string
    ): Promise<ImgurApiData | ImgurPostV1Response> {
        let endpoint: string;
        let responseType: 'ImgurApiResponse' | 'ImgurPostV1Response';

        if (type === 'image') {
            endpoint = `https://api.imgur.com/post/v1/media/${id}?client_id=${this.clientId}&include=media`;
            responseType = 'ImgurPostV1Response';
        } else {
            endpoint = `https://api.imgur.com/3/${type}/${id}?client_id=${this.clientId}`;
            responseType = 'ImgurApiResponse';
        }

        try {
            const response = await this.httpClient.get(endpoint);

            if (responseType === 'ImgurApiResponse') {
                const imgurApiResponse = response.data as ImgurApiResponse;
                if (imgurApiResponse.success && imgurApiResponse.data) {
                    return imgurApiResponse.data;
                }
            } else {
                return response.data as ImgurPostV1Response;
            }

            throw new MediaNotFoundError('Media not found on Imgur.');
        } catch (error) {
            logger.error(`Error fetching media info from Imgur: ${error}`);
            throw new MediaNotFoundError('Failed to fetch media info from Imgur.');
        }
    }

    private extractUrls(data: ImgurApiData | ImgurPostV1Response): string[] {
        if ('is_album' in data && data.is_album && 'images' in data && data.images) {
            return data.images.map(img => img.link);
        } else if ('media' in data && data.media) {
            return data.media.map(media => media.url);
        } else if ('link' in data && data.link) {
            return [data.link];
        }
        return [];
    }

    private extractMetadata(
        data: ImgurApiData | ImgurPostV1Response
    ): MediaInfo['metadata'] {
        let title = 'Untitled';
        let views = 0;
        let author = 'Unknown';
        let likes = 0;

        if ('title' in data) {
            title = data.title || 'Untitled';
        }

        if ('description' in data && data.description) {
            title += ` - ${data.description}`;
        }

        if ('is_album' in data && data.is_album) {
            title += ` (Album)`;
        }

        if ('view_count' in data) {
            views = data.view_count;
        } else if ('views' in data) {
            views = data.views || 0;
        }

        if ('account_url' in data) {
            author = data.account_url || 'Unknown';
        }

        if ('upvote_count' in data && 'downvote_count' in data) {
            likes = data.upvote_count - data.downvote_count;
        } else if ('ups' in data && 'downs' in data) {
            likes = (data.ups || 0) - (data.downs || 0);
        }

        return {
            title: title.trim(),
            author,
            platform: 'Imgur',
            views,
            likes,
        };
    }

    private getFileExtension(url: string): string {
        const parsed = path.parse(new URL(url).pathname);
        return parsed.ext.replace('.', '') || 'unknown';
    }

    private getSize(data: ImgurApiData | ImgurPostV1Response, url: string): number {
        let sizeInBytes = 0;

        if ('media' in data) {
            const media = data.media.find(m => m.url === url);
            sizeInBytes = media ? media.size : 0;
        } else if ('images' in data && data.images) {
            const image = data.images.find(img => img.link === url);
            sizeInBytes = image ? image.size : 0;
        } else if ('size' in data) {
            sizeInBytes = data.size;
        }

        return Number((sizeInBytes / (1024 * 1024)).toFixed(2));
    }
}
