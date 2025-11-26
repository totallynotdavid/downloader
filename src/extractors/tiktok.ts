import { ExtractionError } from "../errors";
import type { Context, MediaResult } from "../types";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    const response = await ctx.http.get(url);
    const html = response.data;

    const match = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/,
    );
    if (!match) {
      throw new Error("Could not find hydration data in page");
    }

    const json = JSON.parse(match[1]);
    const details = json.__DEFAULT_SCOPE__?.["webapp.video-detail"];
    const item = details?.itemInfo?.itemStruct;

    if (!item || !item.video) {
      throw new Error("Video metadata not found in JSON");
    }

    // Use the highest quality bitrate info or default playAddr
    const bitrate_info = item.video.bitrateInfo || [];
    const direct_url =
      bitrate_info.length > 0
        ? bitrate_info[0].PlayAddr.UrlList[0]
        : item.video.playAddr;

    if (!direct_url) {
      throw new Error("No direct video URL found");
    }

    return {
      urls: [
        {
          type: "video",
          url: direct_url,
          filename: `tiktok-${item.id}.mp4`,
        },
      ],
      headers: {
        Referer: "https://www.tiktok.com/",
        "User-Agent": ctx.http.defaults.headers["User-Agent"] as string,
      },
      meta: {
        title: details.shareMeta?.desc || "TikTok Video",
        author: item.author?.nickname || item.author?.uniqueId || "Unknown",
        platform: "tiktok",
        likes: item.stats?.diggCount,
        views: item.stats?.playCount,
      },
    };
  } catch (e: any) {
    throw new ExtractionError(e.message, "tiktok");
  }
}
