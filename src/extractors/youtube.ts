import { load as cheerioLoad } from "cheerio";
import { ExtractionError } from "../errors";
import type { Context, MediaResult } from "../types";

const API_URL = "https://postsyncer.com/api/social-media-downloader";
const PAGE_URL = "https://postsyncer.com/tools/youtube-video-downloader";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    const pageRes = await ctx.http.get(PAGE_URL);
    const $ = cheerioLoad(pageRes.data);

    const csrfToken = $('meta[name="csrf-token"]').attr("content");
    if (!csrfToken) throw new Error("Could not get CSRF token");

    const setCookies = pageRes.headers["set-cookie"] || [];
    const cookieString = setCookies.map((c) => c.split(";")[0]).join("; ");

    const res = await ctx.http.post(
      API_URL,
      JSON.stringify({ url, platform: "youtube" }),
      {
        headers: {
          "content-type": "application/json",
          accept: "*/*",
          referer: PAGE_URL,
          "x-csrf-token": csrfToken,
          cookie: cookieString,
        },
      },
    );

    const data = res.data;

    if (data.error) {
      throw new Error("API returned error");
    }

    const video = data.medias.videos.find((v: any) => v.is_audio);

    if (!video) {
      throw new Error("No video with audio found");
    }

    return {
      urls: [
        {
          type: "video",
          url: video.url,
          filename: `${data.title || "video"}.mp4`,
        },
      ],
      headers: {
        "User-Agent": ctx.http.defaults.headers["User-Agent"] as string,
      },
      meta: {
        title: data.title,
        author: data.author || "Unknown",
        platform: "youtube",
      },
    };
  } catch (e: any) {
    throw new ExtractionError(e.message, "youtube");
  }
}
