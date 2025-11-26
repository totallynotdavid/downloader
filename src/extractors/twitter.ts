import path from "node:path";
import { ExtractionError } from "../errors.ts";
import type { Context, MediaItem, MediaResult } from "../types.ts";

const API_BASE = "https://api.vxtwitter.com";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    const url_obj = new URL(url);
    const api_url = `${API_BASE}${url_obj.pathname}`;

    const response = await ctx.http.get(api_url);
    const data = response.data;

    if (!(data && data.media_extended) || data.media_extended.length === 0) {
      throw new Error("No media found in tweet");
    }

    const items: MediaItem[] = data.media_extended.map(
      (media: any, index: number) => {
        const ext = path.extname(new URL(media.url).pathname) || ".mp4";
        const type =
          media.type === "video" || media.type === "gif" ? "video" : "image";

        return {
          type: type,
          url: media.url,
          filename: `twitter-${data.tweetID}-${index}${ext}`,
        };
      },
    );

    return {
      urls: items,
      headers: {},
      meta: {
        title: data.text || "Twitter Post",
        author: `${data.user_name} (@${data.user_screen_name})`,
        platform: "twitter",
        likes: data.likes,
        views: data.views,
      },
    };
  } catch (e: any) {
    throw new ExtractionError(e.message, "twitter");
  }
}
