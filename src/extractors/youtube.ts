import { ExtractionError } from "../errors";
import type { Context, MediaResult } from "../types";

const ANALYZE_URL = "https://www.y2mate.com/mates/analyzeV2/ajax";
const CONVERT_URL = "https://www.y2mate.com/mates/convertV2/index";

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    // Extract video ID
    const url_obj = new URL(url);
    const video_id =
      url_obj.hostname === "youtu.be"
        ? url_obj.pathname.slice(1)
        : url_obj.searchParams.get("v");

    if (!video_id) throw new Error("Could not find video ID");

    // Send ID to Y2Mate analyze endpoint
    const analyze_params = new URLSearchParams({
      vid: video_id,
      k_query: `https://www.youtube.com/watch?v=${video_id}`,
      k_page: "home",
      hl: "en",
      q_auto: "0",
    });

    const analyze_res = await ctx.http.post(
      ANALYZE_URL,
      analyze_params.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    if (analyze_res.data.status !== "ok") {
      throw new Error("Y2Mate analysis failed");
    }

    // Find best MP4 quality
    const links = analyze_res.data.links?.mp4 || {};
    const qualities = Object.keys(links);
    // Find 1080p, else first available
    const best_quality_key =
      qualities.find((k) => links[k].q === "1080p") || qualities[0];

    if (!best_quality_key) throw new Error("No MP4 links found");

    const item = links[best_quality_key];

    // Send conversion request to generate download link
    const convert_params = new URLSearchParams({
      vid: video_id,
      k: item.k,
    });

    const convert_res = await ctx.http.post(
      CONVERT_URL,
      convert_params.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    if (convert_res.data.status !== "ok" || !convert_res.data.dlink) {
      throw new Error("Y2Mate conversion failed");
    }

    return {
      urls: [
        {
          type: "video",
          url: convert_res.data.dlink,
          filename: `${analyze_res.data.title || video_id}.mp4`,
        },
      ],
      headers: {
        "User-Agent": ctx.http.defaults.headers["User-Agent"] as string,
      },
      meta: {
        title: analyze_res.data.title,
        author: analyze_res.data.a,
        platform: "youtube",
      },
    };
  } catch (e: any) {
    throw new ExtractionError(e.message, "youtube");
  }
}
