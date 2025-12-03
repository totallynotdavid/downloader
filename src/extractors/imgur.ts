import path from "node:path";
import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";

const CLIENT_ID = "546c25a59c58ad7";
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]+$/;

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const url_obj = new URL(url);
    const path_parts = url_obj.pathname.split("/").filter(Boolean);

    const last_part = path_parts[path_parts.length - 1];
    if (!last_part) {
      throw new ParseError("Invalid Imgur URL: no path", "imgur");
    }

    let id = last_part.split(".")[0];
    if (!id) {
      throw new ParseError("Invalid Imgur URL: no ID found", "imgur");
    }

    const is_gallery =
      path_parts.includes("gallery") || path_parts.includes("a");

    if (is_gallery && id.includes("-")) {
      const parts = id.split("-");
      const potential_id = parts[parts.length - 1];
      if (
        potential_id &&
        potential_id.length >= 5 &&
        ALPHANUMERIC_REGEX.test(potential_id)
      ) {
        id = potential_id;
      }
    }

    const endpoint_type = is_gallery ? "album" : "image";
    const endpoint = `https://api.imgur.com/3/${endpoint_type}/${id}?client_id=${CLIENT_ID}`;

    const response = await http_get(endpoint, options);
    const json = (await response.json()) as {
      data?: {
        id: string;
        title: string | null;
        account_url: string | null;
        views: number;
        ups?: number;
        downs?: number;
        type: string;
        link: string;
        images?: Array<{ id: string; type: string; link: string }>;
      };
    };
    const data = json?.data;

    if (!data) {
      throw new ParseError("Imgur API returned no data", "imgur");
    }

    const raw_images = data.images || [data];
    const items: MediaItem[] = [];

    for (const img of raw_images) {
      if (img.link) {
        const ext = path.extname(img.link) || ".jpg";
        items.push({
          type: img.type?.startsWith("video") ? "video" : "image",
          url: img.link,
          filename: `imgur-${img.id}${ext}`,
        });
      }
    }

    if (items.length === 0) {
      throw new ParseError("No media links found", "imgur");
    }

    return {
      urls: items,
      headers: {},
      meta: {
        title: data.title || "Imgur Media",
        author: data.account_url || "Unknown",
        platform: "imgur",
        views: data.views,
        likes: (data.ups || 0) - (data.downs || 0),
      },
    };
  } catch (e: any) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "imgur");
  }
}
