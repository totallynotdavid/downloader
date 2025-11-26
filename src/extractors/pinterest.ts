import crypto from "node:crypto";
import { ExtractionError } from "../errors.ts";
import type { Context, MediaResult } from "../types.ts";

const API_URL = "https://getindevice.com/wp-json/aio-dl/video-data/";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    const token = crypto.randomBytes(16).toString("base64");

    const params = new URLSearchParams({
      url: url,
      token: token,
    });

    const response = await ctx.http.post(API_URL, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://getindevice.com/pinterest-video-downloader/",
      },
    });

    const data = response.data;

    if (!data?.medias || data.medias.length === 0) {
      throw new Error("No media found");
    }

    // Find first video, fallback to first item
    const media =
      data.medias.find((m: any) => m.videoAvailable) || data.medias[0];

    // images: i.pinimg.com with .jpg
    // videos: v1.pinimg.com with .mp4
    const isVideo =
      media.extension === "mp4" ||
      media.url.includes("v1.pinimg.com") ||
      media.url.includes(".mp4");
    const type = isVideo ? "video" : "image";

    return {
      urls: [
        {
          type: type,
          url: media.url,
          filename: `pin-${Date.now()}.${media.extension || (isVideo ? "mp4" : "jpg")}`,
        },
      ],
      headers: {},
      meta: {
        title: data.title || "Pinterest Pin",
        author: "Unknown",
        platform: "pinterest",
      },
    };
  } catch (e: any) {
    throw new ExtractionError(e.message, "pinterest");
  }
}
