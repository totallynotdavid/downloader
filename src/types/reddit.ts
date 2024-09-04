export interface RedditPost {
    data: {
        is_gallery?: boolean;
        gallery_data?: {
            items: Array<{media_id: string}>;
        };
        is_video?: boolean;
        media?: {
            reddit_video?: {
                fallback_url: string;
            };
        };
        secure_media?: {
            oembed?: {
                thumbnail_url: string;
            };
        };
        url?: string;
        title?: string;
        author?: string;
        created_utc?: number;
        subreddit?: string;
        score?: number;
    };
}

export interface RedditApiResponse {
    data: {
        children: RedditPost[];
    };
}
