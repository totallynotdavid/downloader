import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";

const VIDEO_EXTENSION_REGEX = /\.(mp4|mkv|webm)$/i;

// Reddit JSON requires a primed anonymous cookie. Include over18=1 so
// age-gated subreddit media stays reachable.
async function reddit_cookie(options: ResolveOptions): Promise<string> {
  const prime = await http_get("https://old.reddit.com/", options);
  const cookies = prime.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter(Boolean);
  return [...cookies, "over18=1"].join("; ");
}

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const cookie = await reddit_cookie(options);
    const json_url = `${url.replace(/\/$/, "")}.json`;
    const response = await http_get(json_url, {
      ...options,
      headers: { ...options.headers, Cookie: cookie },
    });
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

    const meta: MediaResult["meta"] = {
      title: post.title,
      author: post.author,
      platform: "reddit",
    };
    // view_count is a deprecated field that the public JSON returns as null;
    // only surface likes/views when they are real numbers so we never write a
    // null into a number-typed meta field.
    if (typeof post.score === "number" && Number.isFinite(post.score)) {
      meta.likes = post.score;
    }
    if (
      typeof post.view_count === "number" &&
      Number.isFinite(post.view_count)
    ) {
      meta.views = post.view_count;
    }

    return { urls: items, headers: {}, meta };
  } catch (e: unknown) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    const message = e instanceof Error ? e.message : "Unknown error";
    throw new ParseError(message, "reddit");
  }
}
