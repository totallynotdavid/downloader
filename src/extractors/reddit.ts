import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";

const VIDEO_EXTENSION_REGEX = /\.(mp4|mkv|webm)$/i;

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const json_url = `${url.replace(/\/$/, "")}.json`;
    const response = await http_get(json_url, options);
    const data = await response.json();

    if (!(Array.isArray(data) && data[0]?.data?.children?.[0]?.data)) {
      throw new ParseError("Invalid Reddit API response", "reddit");
    }

    const post = data[0].data.children[0].data;
    const items: MediaItem[] = [];

    if (post.is_gallery && post.media_metadata) {
      const gallery_ids = post.gallery_data?.items || [];
      for (const item of gallery_ids) {
        const media_id = item.media_id;
        const meta = post.media_metadata[media_id];
        if (meta?.s) {
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
    } else if (post.is_video && post.media?.reddit_video?.fallback_url) {
      items.push({
        type: "video",
        url: post.media.reddit_video.fallback_url.replace(/&amp;/g, "&"),
        filename: `reddit-${post.id}.mp4`,
      });
    } else if (post.url_overridden_by_dest || post.url) {
      const direct_url = (post.url_overridden_by_dest || post.url).replace(
        /&amp;/g,
        "&",
      );
      const is_video = direct_url.match(VIDEO_EXTENSION_REGEX);
      items.push({
        type: is_video ? "video" : "image",
        url: direct_url,
        filename: `reddit-${post.id}.${is_video ? "mp4" : "jpg"}`,
      });
    }

    if (items.length === 0) {
      throw new ParseError("No media found in post", "reddit");
    }

    return {
      urls: items,
      headers: {},
      meta: {
        title: post.title,
        author: post.author,
        platform: "reddit",
        likes: post.score,
        views: post.view_count,
      },
    };
  } catch (e: any) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "reddit");
  }
}
