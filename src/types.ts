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
    // Optional enrichment, populated per platform when the response exposes it.
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
  // This cursor comes from a previous page for the same account.
  cursor?: string;
  // This resolves every post for full-resolution `media` and an exact `timestamp`.
  // It costs one extra request per post.
  detail?: boolean;
};

export type Post = {
  shortcode: string;
  url: string;
  // This is the first author. A collab post on the account's grid can belong to another account.
  author: string;
  caption?: string;
  type: "image" | "video" | "carousel";
  thumbnail: string;
  // This is present only when `detail` is true.
  media?: MediaItem[];
  // This is Unix seconds and is present only when `detail` is true.
  timestamp?: number;
};

export type PostPage = {
  posts: Post[];
  // This is absent on the last page.
  cursor?: string;
};
