import path from "node:path";
import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";

const API_BASE = "https://api.vxtwitter.com";

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const url_obj = new URL(url);
    const api_url = `${API_BASE}${url_obj.pathname}`;

    const response = await http_get(api_url, options);
    const data = (await response.json()) as {
      media_extended?: Array<{ type: string; url: string }>;
      tweetID?: string;
      text?: string;
      user_name?: string;
      user_screen_name?: string;
      likes?: number;
      views?: number;
      replies?: number;
      retweets?: number;
      date_epoch?: number;
    };

    if (!data?.media_extended || data.media_extended.length === 0) {
      throw new ParseError("No media found in tweet", "twitter");
    }

    const items: MediaItem[] = data.media_extended.map(
      (media, index: number) => {
        const ext = path.extname(new URL(media.url).pathname) || ".mp4";
        const type =
          media.type === "video" || media.type === "gif" ? "video" : "image";

        return {
          type: type,
          url: media.url,
          filename: `twitter-${data.tweetID}-${index + 1}${ext}`,
        };
      },
    );

    const meta: MediaResult["meta"] = {
      title: data.text || "Twitter post",
      author: `${data.user_name} (@${data.user_screen_name})`,
      platform: "twitter",
    };
    if (data.likes !== undefined) {
      meta.likes = data.likes;
    }
    if (data.views !== undefined) {
      meta.views = data.views;
    }
    if (data.replies !== undefined) {
      meta.comments = data.replies;
    }
    if (data.retweets !== undefined) {
      meta.reposts = data.retweets;
    }
    if (data.date_epoch !== undefined) {
      meta.timestamp = data.date_epoch;
    }

    return {
      urls: items,
      headers: {},
      meta,
    };
  } catch (e: unknown) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    const message = e instanceof Error ? e.message : "Unknown error";
    throw new ParseError(message, "twitter");
  }
}
