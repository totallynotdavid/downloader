import { http_get, http_post } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";

const INNERTUBE_API_URL = "https://www.youtube.com/youtubei/v1/player?key=";

const ANDROID_CLIENT = {
  clientName: "ANDROID",
  clientVersion: "21.02.35",
  androidSdkVersion: 30,
  hl: "en",
  gl: "US",
  userAgent: "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip",
};

type YoutubePlayerResponse = {
  playabilityStatus?: { status: string; reason?: string };
  videoDetails?: {
    title: string;
    author: string;
    viewCount: string;
  };
  streamingData?: {
    formats?: Array<YoutubeFormat>;
    adaptiveFormats?: Array<YoutubeFormat>;
  };
};

type YoutubeFormat = {
  url?: string;
  mimeType: string;
  width?: number;
  bitrate: number;
  audioChannels?: number;
};

function extract_video_id(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function sanitize_filename(title: string): string {
  return title.replace(/[<>:"/\\|?*]/g, "").trim();
}

function extract_innertube_key(html: string): string | null {
  const match = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  return match?.[1] || null;
}

function select_urls(
  data: YoutubePlayerResponse,
  video_id: string,
): MediaItem[] {
  if (data.playabilityStatus?.status !== "OK") {
    throw new ParseError(
      data.playabilityStatus?.reason || "Video not playable",
      "youtube",
    );
  }

  if (!data.streamingData) {
    throw new ParseError("No streaming data available", "youtube");
  }

  const formats = [
    ...(data.streamingData.formats || []),
    ...(data.streamingData.adaptiveFormats || []),
  ];

  const urls: MediaItem[] = [];

  const combined = formats
    .filter(
      (f) =>
        f.url &&
        f.audioChannels &&
        f.audioChannels > 0 &&
        f.width &&
        f.width > 0,
    )
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0];

  if (combined?.url) {
    urls.push({
      type: "video",
      url: combined.url,
      filename: `youtube-${video_id}.mp4`,
    });
  }

  const video_only = formats
    .filter(
      (f) =>
        f.url &&
        f.width &&
        f.width > 0 &&
        (!f.audioChannels || f.audioChannels === 0) &&
        f.mimeType.includes("video/mp4"),
    )
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0];

  const audio_only = formats
    .filter(
      (f) =>
        f.url &&
        f.audioChannels &&
        f.audioChannels > 0 &&
        (!f.width || f.width === 0) &&
        f.mimeType.includes("audio/mp4"),
    )
    .sort((a, b) => b.bitrate - a.bitrate)[0];

  if (
    video_only?.url &&
    video_only.width &&
    video_only.width > (combined?.width || 0)
  ) {
    const ext = video_only.mimeType.includes("webm") ? "webm" : "mp4";
    urls.push({
      type: "video",
      url: video_only.url,
      filename: `youtube-${video_id}-video.${ext}`,
    });

    if (audio_only?.url) {
      urls.push({
        type: "audio",
        url: audio_only.url,
        filename: `youtube-${video_id}-audio.m4a`,
      });
    }
  }

  if (urls.length === 0) {
    throw new ParseError("No downloadable formats found", "youtube");
  }

  return urls;
}

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const video_id = extract_video_id(url);
    if (!video_id) {
      throw new ParseError("Could not extract video ID from URL", "youtube");
    }

    const timeout = options.timeout ?? 15_000;
    const request_headers = {
      "Accept-Language": "en-US,en;q=0.9",
      ...options.headers,
    };

    const page = await http_get(`https://www.youtube.com/watch?v=${video_id}`, {
      headers: request_headers,
      timeout,
    });

    const html = await page.text();
    const api_key = extract_innertube_key(html);

    if (!api_key) {
      throw new ParseError("Could not find Innertube API key", "youtube");
    }

    const innertube_response = await http_post(
      `${INNERTUBE_API_URL}${api_key}`,
      JSON.stringify({
        videoId: video_id,
        context: { client: ANDROID_CLIENT },
        contentCheckOk: true,
        racyCheckOk: true,
      }),
      {
        headers: {
          ...request_headers,
          "Content-Type": "application/json",
          "User-Agent": ANDROID_CLIENT.userAgent,
          "X-Youtube-Client-Name": "3",
          "X-Youtube-Client-Version": ANDROID_CLIENT.clientVersion,
        },
        timeout,
      },
    );

    const data = (await innertube_response.json()) as YoutubePlayerResponse;

    const urls = select_urls(data, video_id);

    const title = data.videoDetails?.title || "YouTube video";
    const author = data.videoDetails?.author || "Unknown";
    const views = data.videoDetails?.viewCount
      ? Number.parseInt(data.videoDetails.viewCount, 10)
      : undefined;

    const meta: MediaResult["meta"] = {
      title: sanitize_filename(title),
      author,
      platform: "youtube",
    };
    if (views !== undefined && Number.isFinite(views)) {
      meta.views = views;
    }

    return {
      urls,
      headers: {},
      meta,
    };
  } catch (e: any) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "youtube");
  }
}
