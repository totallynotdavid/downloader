import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const HYDRATION_DATA_REGEX =
  /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([^<]+)<\/script>/;

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const target_url = url.replace("/photo/", "/video/");

  try {
    const response = await http_get(target_url, options);
    const html = await response.text();

    const match = html.match(HYDRATION_DATA_REGEX);
    if (!match?.[1]) {
      throw new ParseError("Could not find hydration data", "tiktok");
    }

    const json = JSON.parse(match[1]) as {
      __DEFAULT_SCOPE__?: {
        "webapp.video-detail"?: {
          itemInfo?: { itemStruct?: any };
          shareMeta?: { desc?: string };
        };
      };
    };
    const details = json.__DEFAULT_SCOPE__?.["webapp.video-detail"];
    const item = details?.itemInfo?.itemStruct;

    if (!item) {
      throw new ParseError("Metadata not found", "tiktok");
    }

    const result_urls: MediaResult["urls"] = [];

    if (item.imagePost?.images) {
      item.imagePost.images.forEach((img: any, index: number) => {
        const direct_url = img.imageURL?.urlList?.[0];
        if (direct_url) {
          result_urls.push({
            type: "image",
            url: direct_url,
            filename: `tiktok-${item.id}-${index + 1}.jpg`,
          });
        }
      });

      if (item.music?.playUrl) {
        result_urls.push({
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
        result_urls.push({
          type: "video",
          url: direct_url,
          filename: `tiktok-${item.id}.mp4`,
        });
      }
    }

    if (result_urls.length === 0) {
      throw new ParseError("No media content found", "tiktok");
    }

    return {
      urls: result_urls,
      headers: {
        Referer: "https://www.tiktok.com/",
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
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "tiktok");
  }
}
