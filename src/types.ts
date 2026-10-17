export type ResolveOptions = {
  timeout?: number;
  headers?: Record<string, string>;
};

export type MediaItem = {
  type: "image" | "video" | "audio";
  url: string;
  filename: string;
};

export type MediaResult = {
  urls: MediaItem[];
  headers: Record<string, string>;
  meta: {
    title: string;
    author: string;
    platform: string;
    description?: string;
    thumbnail?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    reposts?: number;
    timestamp?: number;
  };
};

export type ListPostsOptions = ResolveOptions & {
  cursor?: string;
  detail?: boolean;
};

export type Post = {
  shortcode: string;
  url: string;
  author: string;
  caption?: string;
  type: "image" | "video" | "carousel";
  thumbnail: string;
  media?: MediaItem[];
  timestamp?: number;
};

export type PostPage = {
  posts: Post[];
  cursor?: string;
};
