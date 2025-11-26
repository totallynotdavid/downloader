import { ExtractionError } from "../errors";
import type { Context, MediaResult } from "../types";

const API_URL = "https://172.67.222.44/api/ajaxSearch/facebook";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  const params = new URLSearchParams();
  params.append("q", url);
  params.append("vt", "facebook");

  try {
    const response = await ctx.http.post(API_URL, params.toString(), {
      headers: {
        Host: "x2download.app",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: "https://x2download.app",
        Referer: "https://x2download.app/",
      },
    });

    const data = response.data;

    if (!data || data.status !== "ok") {
      throw new Error("Upstream service returned invalid status");
    }

    // Prefer HD, fallback to SD
    const video_link = data.links?.hd || data.links?.sd;

    if (!video_link) {
      throw new Error("No video links found in response");
    }

    return {
      urls: [
        {
          type: "video",
          url: video_link,
          filename: `fb-${Date.now()}.mp4`,
        },
      ],
      headers: {
        "User-Agent": ctx.http.defaults.headers["User-Agent"] as string,
      },
      meta: {
        title: data.title || "Facebook Video",
        author: data.author || "Unknown",
        platform: "facebook",
      },
    };
  } catch (e: any) {
    throw new ExtractionError(e.message, "facebook");
  }
}
