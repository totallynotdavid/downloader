export interface DownloaderConfig {
    downloadDir?: string;
    proxy?: string;
}

export interface DownloadOptions {
    quality?: string;
    downloadMedia?: boolean;
    preferAudio?: boolean;
}

export interface MediaInfo {
    urls: Array<{
        url: string;
        quality: string;
        format: string;
        size: number;
    }>;
    localPath?: string;
    metadata: {
        title: string;
        author: string;
        platform: string;
        views?: number;
        likes?: number;
    };
}

export interface PlatformHandler {
    getMediaInfo(
        url: string,
        options: Required<DownloadOptions>,
        config: DownloaderConfig
    ): Promise<MediaInfo>;
    isValidUrl(url: string): boolean;
}
