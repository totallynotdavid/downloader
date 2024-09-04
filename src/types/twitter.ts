export interface MediaItem {
    url: string;
    type: string;
}

export interface MediaInfo {
    text: string;
    media: MediaItem[];
}

export interface VxTwitterApiResponse {
    text: string;
    media_extended: {
        url: string;
        type: string;
    }[];
    url: string;
}
