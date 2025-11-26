import type { AxiosInstance } from "axios";

export type Platform =
  | "instagram"
  | "tiktok"
  | "twitter"
  | "youtube"
  | "facebook"
  | "reddit"
  | "imgur"
  | "pinterest";

export type ResolveOptions = {
  proxy?: string;
  timeout?: number;
};

export type Context = {
  http: AxiosInstance;
  options: ResolveOptions;
};

export type MediaItem = {
  type: "image" | "video";
  url: string;
  filename: string;
  headers?: Record<string, string>;
};

export type MediaResult = {
  urls: MediaItem[];
  headers: Record<string, string>;
  meta: {
    title: string;
    author: string;
    platform: Platform;
    views?: number;
    likes?: number;
  };
};

export type ExtractorFn = (url: string, ctx: Context) => Promise<MediaResult>;
