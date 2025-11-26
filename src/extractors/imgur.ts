import path from "node:path";
import { ExtractionError } from "../errors.ts";
import type { Context, MediaItem, MediaResult } from "../types.ts";

const CLIENT_ID = "546c25a59c58ad7";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    const url_obj = new URL(url);
    const path_parts = url_obj.pathname.split("/").filter(Boolean);

    // i.imgur.com/ID.jpg -> ID
    // imgur.com/gallery/ID -> ID
    // imgur.com/gallery/title-slug-ID -> ID (extract last part after last hyphen)
    // imgur.com/a/ID -> ID
    const last_part = path_parts[path_parts.length - 1];
    let id = last_part.split(".")[0];

    const is_gallery =
      path_parts.includes("gallery") || path_parts.includes("a");

    // For gallery URLs with slugs (e.g., "title-slug-hxXHU13"),
    // extract the actual ID
    if (is_gallery && id.includes("-")) {
      const parts = id.split("-");
      const potential_id = parts[parts.length - 1];
      if (potential_id.length >= 5 && /^[a-zA-Z0-9]+$/.test(potential_id)) {
        id = potential_id;
      }
    }

    const endpoint_type = is_gallery ? "album" : "image";
    const endpoint = `https://api.imgur.com/3/${endpoint_type}/${id}?client_id=${CLIENT_ID}`;

    const response = await ctx.http.get(endpoint);
    const data = response.data?.data;

    if (!data) {
      throw new Error("Imgur API returned no data");
    }

    // Normalize images: If album, use `images` array. If single, wrap `data` in array.
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
      throw new Error("No media links found");
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
    throw new ExtractionError(e.message, "imgur");
  }
}
