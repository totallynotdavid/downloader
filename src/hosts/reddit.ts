import axios, {AxiosResponse} from 'axios';
import {DownloaderOptions, DownloaderResult} from '@/types';

interface RedditPost {
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

interface RedditApiResponse {
    data: {
        children: RedditPost[];
    };
}

class RedditDownloader {
    constructor() {}

    async getDirectUrls(
        redditUrl: string,
        options: DownloaderOptions
    ): Promise<DownloaderResult> {
        try {
            const urls = await this.getMediaInfo(redditUrl);
            const result: DownloaderResult = {urls};

            if (options.includeMetadata) {
                const metadata = await this.getMetadata(redditUrl);
                result.metadata = metadata;
            }

            return result;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to process URL: ${error.message}`);
            } else {
                throw new Error('An unknown error occurred');
            }
        }
    }

    async getMetadata(redditUrl: string): Promise<Record<string, unknown>> {
        const url = redditUrl.endsWith('.json') ? redditUrl : `${redditUrl}.json`;

        try {
            const response: AxiosResponse<RedditApiResponse[]> = await axios.get(url);
            if (response.data?.[0]?.data?.children?.[0]?.data) {
                const postData = response.data[0].data.children[0].data;
                return this.extractMetadata(postData);
            } else {
                throw new Error('Unexpected response structure');
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error fetching Reddit metadata: ${error.message}`);
            } else {
                throw new Error(
                    'An unknown error occurred while fetching Reddit metadata'
                );
            }
        }
    }

    private async getMediaInfo(redditUrl: string): Promise<string[]> {
        const url = redditUrl.endsWith('.json') ? redditUrl : `${redditUrl}.json`;

        try {
            const response: AxiosResponse<RedditApiResponse[]> = await axios.get(url);
            if (response.data?.[0]?.data?.children) {
                const posts = response.data[0].data.children;
                const mediaUrls: string[] = [];

                for (const post of posts) {
                    const urls = this.processRedditPost(post.data);
                    mediaUrls.push(...urls);
                }

                return mediaUrls;
            } else {
                throw new Error('Unexpected response structure');
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error fetching Reddit data: ${error.message}`);
            } else {
                throw new Error('An unknown error occurred while fetching Reddit data');
            }
        }
    }

    private processRedditPost(postData: RedditPost['data']): string[] {
        const mediaUrls: string[] = [];

        if (postData.is_gallery && postData.gallery_data?.items) {
            mediaUrls.push(
                ...postData.gallery_data.items.map(
                    item => `https://i.redd.it/${item.media_id}.jpg`
                )
            );
        } else if (postData.is_video && postData.media?.reddit_video?.fallback_url) {
            mediaUrls.push(postData.media.reddit_video.fallback_url);
        } else if (postData.secure_media?.oembed?.thumbnail_url) {
            mediaUrls.push(postData.secure_media.oembed.thumbnail_url);
        } else if (postData.url) {
            mediaUrls.push(postData.url);
        }

        return mediaUrls;
    }

    private extractMetadata(postData: RedditPost['data']): Record<string, unknown> {
        return {
            title: postData.title,
            author: postData.author,
            created_utc: postData.created_utc,
            subreddit: postData.subreddit,
            score: postData.score,
            is_gallery: postData.is_gallery,
            is_video: postData.is_video,
        };
    }
}

export default RedditDownloader;
