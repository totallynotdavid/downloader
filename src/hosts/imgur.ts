import axios, {AxiosResponse} from 'axios';

interface ParsedUrl {
    type: 'image' | 'album';
    id: string;
}

interface ImageInfo {
    id: string;
    title: string | null;
    description: string | null;
    datetime: number;
    type: string;
    animated: boolean;
    width: number;
    height: number;
    size: number;
    views: number;
    link: string;
    mp4?: string;
    gifv?: string;
}

interface AlbumInfo {
    id: string;
    title: string | null;
    description: string | null;
    datetime: number;
    cover: string | null;
    images: ImageInfo[];
    imageCount: number;
    isAlbum: true;
}

type MediaInfo = ImageInfo | AlbumInfo;

interface DirectUrlsAndCount {
    urls: string[];
    count: number;
}

/*
 * Handles downloading and parsing of Imgur media content.
 * Supports single images, albums, and gallery links.
 * Uses the Imgur API to fetch media information.
 *
 * @testCases
 * single image: https://i.imgur.com/7q4TxW7.png
 * single image as a gallery: https://imgur.com/gallery/ouMQkN1
 * album with multiple images: https://imgur.com/gallery/art-gallery-ready-to-heist-free-dnd-ttrpg-maps-dTFUK1E
 * video album: https://imgur.com/gallery/mouth-movements-hxXHU13
 */
class ImgurDownloader {
    private readonly clientId: string;
    private readonly isProduction: boolean;

    constructor(isProduction: boolean = false) {
        this.clientId = '546c25a59c58ad7';
        this.isProduction = isProduction;
    }

    async getMediaInfo(url: string): Promise<MediaInfo | string[]> {
        const {type, id} = this.parseUrl(url);
        try {
            const response = await this.fetchMediaInfo(type, id);
            const parsedData = this.parseMediaInfo(response.data);
            return this.isProduction ? this.getDirectUrls(parsedData) : parsedData;
        } catch (error) {
            const errorMessage = this.handleError(error, url);
            throw new Error(errorMessage);
        }
    }

    private parseUrl(url: string): ParsedUrl {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        if (urlObj.hostname === 'i.imgur.com') {
            return {type: 'image', id: pathParts[0]?.split('.')[0] ?? ''};
        } else if (pathParts.includes('gallery') || pathParts.includes('a')) {
            const id = pathParts[pathParts.length - 1]?.split('.')[0] ?? '';
            const finalId = id.includes('-') ? (id.split('-').pop() ?? '') : id;
            return {type: 'album', id: finalId};
        } else {
            return {type: 'image', id: pathParts[pathParts.length - 1] ?? ''};
        }
    }

    private async fetchMediaInfo(type: string, id: string): Promise<AxiosResponse> {
        const endpoint = `https://api.imgur.com/3/${type}/${id}?client_id=${this.clientId}&include=media`;
        return await axios.get(endpoint);
    }

    private parseMediaInfo(data: any): MediaInfo {
        if (data.data.is_album) {
            return this.parseAlbumInfo(data.data);
        } else {
            return this.parseSingleMediaInfo(data.data);
        }
    }

    private parseAlbumInfo(albumData: any): AlbumInfo {
        return {
            id: albumData.id,
            title: albumData.title || null,
            description: albumData.description || null,
            datetime: albumData.datetime,
            cover: albumData.cover
                ? `https://i.imgur.com/${albumData.cover}.${albumData.cover_ext}`
                : null,
            images: albumData.images.map((img: any) => this.parseImageInfo(img)),
            imageCount: albumData.images_count,
            isAlbum: true,
        };
    }

    private parseSingleMediaInfo(mediaData: any): ImageInfo {
        return this.parseImageInfo(mediaData);
    }

    private parseImageInfo(imageData: any): ImageInfo {
        return {
            id: imageData.id,
            title: imageData.title || null,
            description: imageData.description || null,
            datetime: imageData.datetime,
            type: imageData.type,
            animated: imageData.animated,
            width: imageData.width,
            height: imageData.height,
            size: imageData.size,
            views: imageData.views,
            link: imageData.link,
            mp4: imageData.mp4,
            gifv: imageData.gifv,
        };
    }

    private getDirectUrls(parsedData: MediaInfo): string[] {
        if ('isAlbum' in parsedData) {
            return parsedData.images.map(img => img.link);
        } else {
            return [parsedData.link];
        }
    }

    private handleError(error: any, url: string): string {
        let errorMessage = `Failed to fetch media info for ${url}: `;
        if (axios.isAxiosError(error) && error.response) {
            errorMessage += `Status ${error.response.status}`;
            if (
                error.response.data &&
                error.response.data.data &&
                error.response.data.data.error
            ) {
                errorMessage += ` - ${error.response.data.data.error}`;
            }
        } else if (axios.isAxiosError(error) && error.request) {
            errorMessage += 'No response received from server';
        } else {
            errorMessage += error instanceof Error ? error.message : String(error);
        }
        return errorMessage;
    }

    async getDirectUrlsAndCount(url: string): Promise<DirectUrlsAndCount> {
        try {
            const result = await this.getMediaInfo(url);
            let urls: string[];
            if (Array.isArray(result)) {
                urls = result;
            } else if ('isAlbum' in result) {
                urls = result.images.map(img => img.link);
            } else {
                urls = [result.link];
            }
            return {
                urls: urls,
                count: urls.length,
            };
        } catch (error) {
            throw error;
        }
    }
}

export default ImgurDownloader;
