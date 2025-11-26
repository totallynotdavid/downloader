import crypto from "node:crypto";
import { ExtractionError } from "../errors";
import type { Context, MediaResult } from "../types";

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

    if (!data || !data.medias || data.medias.length === 0) {
      throw new Error("No media found");
    }

    // Find first video, fallback to first item
    const media =
      data.medias.find((m: any) => m.videoAvailable) || data.medias[0];

    return {
      urls: [
        {
          type: "video",
          url: media.url,
          filename: `pin-${Date.now()}.${media.extension || "mp4"}`,
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
