import crypto from "node:crypto";
import { http_post } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const API_URL = "https://getindevice.com/wp-json/aio-dl/video-data/";

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const token = crypto.randomBytes(16).toString("base64");

    const params = new URLSearchParams({
      url: url,
      token: token,
    });

    const response = await http_post(API_URL, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://getindevice.com/pinterest-video-downloader/",
        ...options.headers,
      },
      timeout: options.timeout,
    });

    const data = (await response.json()) as {
      title?: string;
      medias: Array<{
        url: string;
        extension: string;
        videoAvailable?: boolean;
      }>;
    };

    if (data.medias.length === 0) {
      throw new ParseError("No media found", "pinterest");
    }

    const media = data.medias.find((m) => m.videoAvailable) || data.medias[0];
    if (!media) {
      throw new ParseError("No valid media in response", "pinterest");
    }

    const is_video =
      media.extension === "mp4" ||
      media.url.includes("v1.pinimg.com") ||
      media.url.includes(".mp4");
    const type = is_video ? "video" : "image";

    return {
      urls: [
        {
          type: type,
          url: media.url,
          filename: `pin-${Date.now()}.${media.extension || (is_video ? "mp4" : "jpg")}`,
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
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "pinterest");
  }
}
