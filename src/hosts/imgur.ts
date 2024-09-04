import axios from 'axios';
import {DownloaderOptions, DownloaderResult} from '@/types';

interface ParsedUrl {
    type: 'image' | 'album';
    id: string;
}

interface ImgurApiResponse {
    data: ImgurApiData;
    success: boolean;
    status: number;
}

interface ImgurApiData {
    link?: string;
    images?: {link: string}[];
    is_album?: boolean;
    title?: string;
    description?: string;
    datetime?: number;
    views?: number;
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

    constructor() {
        this.clientId = '546c25a59c58ad7';
    }

    async getDirectUrls(
        url: string,
        options: DownloaderOptions
    ): Promise<DownloaderResult> {
        const {type, id} = this.parseUrl(url);
        const response = await this.fetchMediaInfo(type, id);
        const urls = this.extractUrls(response.data);
        return {urls};
    }

    async getMetadata(url: string): Promise<Record<string, unknown>> {
        const {type, id} = this.parseUrl(url);
        const response = await this.fetchMediaInfo(type, id);
        return this.extractMetadata(response.data);
    }

    private parseUrl(url: string): ParsedUrl {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        if (urlObj.hostname === 'i.imgur.com') {
            return {type: 'image', id: pathParts[0]?.split('.')[0] ?? ''};
        } else if (pathParts.includes('gallery') || pathParts.includes('a')) {
            const id = pathParts[pathParts.length - 1]?.split('.')[0] ?? '';
            return {
                type: 'album',
                id: id.includes('-') ? (id.split('-').pop() ?? '') : id,
            };
        } else {
            return {type: 'image', id: pathParts[pathParts.length - 1] ?? ''};
        }
    }

    private async fetchMediaInfo(type: string, id: string): Promise<ImgurApiResponse> {
        const endpoint = `https://api.imgur.com/3/${type}/${id}?client_id=${this.clientId}&include=media`;
        return (await axios.get<ImgurApiResponse>(endpoint)).data;
    }

    private extractUrls(data: ImgurApiData): string[] {
        if (data.is_album && data.images) {
            return data.images.map(img => img.link);
        } else if (data.link) {
            return [data.link];
        }
        return [];
    }

    private extractMetadata(data: ImgurApiData): Record<string, unknown> {
        return {
            title: data.title,
            description: data.description,
            datetime: data.datetime,
            views: data.views,
            is_album: data.is_album,
            image_count: data.images?.length ?? 1,
        };
    }
}

export default ImgurDownloader;
