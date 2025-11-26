import { ExtractionError } from "../errors.ts";
import type { Context, MediaItem, MediaResult } from "../types.ts";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    const json_url = `${url.replace(/\/$/, "")}.json`;
    const response = await ctx.http.get(json_url);
    const data = response.data;

    if (!(Array.isArray(data) && data[0]?.data?.children?.[0]?.data)) {
      throw new Error("Invalid Reddit API response");
    }

    const post = data[0].data.children[0].data;
    const items: MediaItem[] = [];

    // case 1: gallery
    if (post.is_gallery && post.media_metadata) {
      const gallery_ids = post.gallery_data?.items || [];
      for (const item of gallery_ids) {
        const media_id = item.media_id;
        const meta = post.media_metadata[media_id];
        if (meta?.s) {
          // URLs are often escaped like &amp;
          const raw_url = meta.s.u || meta.s.gif;
          if (raw_url) {
            items.push({
              type: "image",
              url: raw_url.replace(/&amp;/g, "&"),
              filename: `reddit-${media_id}.jpg`,
            });
          }
        }
      }
    }

    // case 2: video
    else if (post.is_video && post.media?.reddit_video?.fallback_url) {
      items.push({
        type: "video",
        url: post.media.reddit_video.fallback_url.replace(/&amp;/g, "&"),
        filename: `reddit-${post.id}.mp4`,
      });
    }

    // case 3: direct link (image/video/external)
    else if (post.url_overridden_by_dest || post.url) {
      const direct_url = (post.url_overridden_by_dest || post.url).replace(
        /&amp;/g,
        "&",
      );
      const is_video = direct_url.match(/\.(mp4|mkv|webm)$/i);
      items.push({
        type: is_video ? "video" : "image",
        url: direct_url,
        filename: `reddit-${post.id}.${is_video ? "mp4" : "jpg"}`,
      });
    }

    if (items.length === 0) {
      throw new Error("No media found in post");
    }

    return {
      urls: items,
      headers: {
        "User-Agent": ctx.http.defaults.headers["User-Agent"] as string,
      },
      meta: {
        title: post.title,
        author: post.author,
        platform: "reddit",
        likes: post.score,
        views: post.view_count,
      },
    };
  } catch (e: any) {
    throw new ExtractionError(e.message, "reddit");
  }
}
