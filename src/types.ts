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
    views?: number;
    likes?: number;
  };
};
