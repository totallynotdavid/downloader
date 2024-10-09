export interface DownloaderConfig {
    downloadDir: string;
    proxy?: string;
    concurrencyLimit?: number;
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
        localPath?: string;
    }>;
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

// Imgur

export interface ImgurApiResponse {
    data: ImgurApiData;
    success: boolean;
    status: number;
}

export interface ImgurPostV1Response {
    id: string;
    account_id: number;
    title: string;
    description: string;
    view_count: number;
    upvote_count: number;
    downvote_count: number;
    point_count: number;
    is_album: boolean;
    created_at: string;
    updated_at: string | null;
    url: string;
    privacy: string;
    media: Array<{
        id: string;
        account_id: number;
        mime_type: string;
        type: string;
        name: string;
        basename: string;
        url: string;
        ext: string;
        width: number;
        height: number;
        size: number;
        metadata: {
            title: string;
            description: string;
            is_animated: boolean;
            is_looping: boolean;
            duration: number;
            has_sound: boolean;
        };
        created_at: string;
        updated_at: string | null;
    }>;
}

export interface ImgurApiData {
    id: string;
    title: string;
    description: string;
    datetime: number;
    type: string;
    animated: boolean;
    width: number;
    height: number;
    size: number;
    views: number;
    bandwidth: number;
    vote: any;
    favorite: boolean;
    nsfw: boolean;
    section: any;
    account_url: string;
    account_id: number;
    is_ad: boolean;
    in_most_viral: boolean;
    has_sound: boolean;
    tags: any[];
    ad_type: number;
    ad_url: string;
    edited: string;
    in_gallery: boolean;
    link: string;
    comment_count: number;
    favorite_count: number;
    ups: number;
    downs: number;
    points: number;
    score: number;
    is_album: boolean;
    images_count?: number;
    images?: ImgurImageData[];
}

export interface ImgurImageData {
    id: string;
    title: string;
    description: string;
    datetime: number;
    type: string;
    animated: boolean;
    width: number;
    height: number;
    size: number;
    views: number;
    bandwidth: number;
    vote: any;
    favorite: boolean;
    nsfw: boolean;
    section: any;
    account_url: any;
    account_id: any;
    is_ad: boolean;
    in_most_viral: boolean;
    has_sound: boolean;
    tags: any[];
    ad_type: number;
    ad_url: string;
    edited: string;
    in_gallery: boolean;
    link: string;
}

// Pinterest

export interface PinterestMediaInfo {
    medias: {
        videoAvailable: boolean;
        audioAvailable: boolean;
        url: string;
        quality: string;
        extension: string;
        size: number;
    }[];
    title?: string;
}

// Twitter

export interface TwitterMediaItem {
    url: string;
    type: string;
}

export interface TwitterApiResponse {
    text: string;
    user_name: string;
    user_screen_name: string;
    views: number;
    likes: number;
    tweetID: string;
    media_extended: TwitterMediaItem[];
}
