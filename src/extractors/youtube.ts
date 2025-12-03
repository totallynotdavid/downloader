import { load as cheerio_load } from "cheerio";
import { http_get, http_post } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const API_URL = "https://postsyncer.com/api/social-media-downloader";
const PAGE_URL = "https://postsyncer.com/tools/youtube-video-downloader";

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const page_res = await http_get(PAGE_URL, options);
    const html = await page_res.text();
    const $ = cheerio_load(html);

    const csrf_token = $('meta[name="csrf-token"]').attr("content");
    if (!csrf_token) {
      throw new ParseError("Could not get CSRF token", "youtube");
    }

    const set_cookies = page_res.headers.get("set-cookie");
    const cookie_string = set_cookies
      ? set_cookies
          .split(",")
          .map((c) => c.split(";")[0])
          .join("; ")
      : "";

    const res = await http_post(
      API_URL,
      JSON.stringify({ url, platform: "youtube" }),
      {
        headers: {
          "content-type": "application/json",
          accept: "*/*",
          referer: PAGE_URL,
          "x-csrf-token": csrf_token,
          cookie: cookie_string,
          ...options.headers,
        },
        timeout: options.timeout,
      },
    );

    const data = (await res.json()) as {
      error?: boolean;
      title?: string;
      author?: string;
      medias?: {
        videos?: Array<{
          url: string;
          is_audio?: boolean;
        }>;
      };
    };

    if (data.error) {
      throw new ParseError("API returned error", "youtube");
    }

    const video = data.medias?.videos?.find((v) => v.is_audio);

    if (!video) {
      throw new ParseError("No video with audio found", "youtube");
    }

    return {
      urls: [
        {
          type: "video",
          url: video.url,
          filename: `${data.title || "video"}.mp4`,
        },
      ],
      headers: {},
      meta: {
        title: data.title || "YouTube video",
        author: data.author || "Unknown",
        platform: "youtube",
      },
    };
  } catch (e: any) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "youtube");
  }
}
