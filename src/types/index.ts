import {QualityType} from '@/utils/mapQualityToSite';
import {HostType} from '@/utils/determineSite';

export interface DownloaderResult {
    urls: string[];
    metadata?: Record<string, unknown>;
}

export interface DownloaderOptions {
    includeMetadata?: boolean;
    quality?: QualityType;
    maxSize?: number;
    preferAudio?: boolean;
}

export interface Downloader {
    getDirectUrls: (url: string, options: DownloaderOptions) => Promise<DownloaderResult>;
    getMetadata: (url: string) => Promise<Record<string, unknown>>;
}

export {HostType, QualityType};
