export interface TwitterMediaItem {
    url: string;
    type: string;
}

export interface TwitterApiResponse {
    text: string;
    user: {
        username: string;
    };
    views: number;
    likes: number;
    media_extended: TwitterMediaItem[];
}
