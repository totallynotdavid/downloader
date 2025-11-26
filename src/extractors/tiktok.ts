import { ExtractionError } from "../errors.ts";
import type { Context, MediaResult } from "../types.ts";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  // Replacing with /video/ forces the standard video-detail structure.
  const targetUrl = url.replace("/photo/", "/video/");

  try {
    const response = await ctx.http.get(targetUrl);
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

    if (!item) {
      throw new Error("Metadata not found in JSON");
    }

    const resultUrls: MediaResult["urls"] = [];

    if (item.imagePost?.images) {
      item.imagePost.images.forEach((img: any, index: number) => {
        const directUrl = img.imageURL?.urlList?.[0];
        if (directUrl) {
          resultUrls.push({
            type: "image",
            url: directUrl,
            filename: `tiktok-${item.id}-${index + 1}.jpg`,
          });
        }
      });

      if (item.music?.playUrl) {
        resultUrls.push({
          type: "audio",
          url: item.music.playUrl,
          filename: `tiktok-${item.id}-audio.mp3`,
        });
      }
    } else if (item.video) {
      const bitrate_info = item.video.bitrateInfo || [];
      const direct_url =
        bitrate_info.length > 0
          ? bitrate_info[0].PlayAddr.UrlList[0]
          : item.video.playAddr;

      if (direct_url) {
        resultUrls.push({
          type: "video",
          url: direct_url,
          filename: `tiktok-${item.id}.mp4`,
        });
      }
    }

    if (resultUrls.length === 0) {
      throw new Error("No media content found");
    }

    return {
      urls: resultUrls,
      headers: {
        Referer: "https://www.tiktok.com/",
        "User-Agent": ctx.http.defaults.headers["User-Agent"] as string,
      },
      meta: {
        title: details.shareMeta?.desc || item.desc || "TikTok Post",
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
