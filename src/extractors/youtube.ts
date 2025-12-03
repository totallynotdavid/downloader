import { http_post } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";

const INNERTUBE_API_URL =
  "https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";

// Android client config (simpler, doesn't require signature deciphering for most videos)
const INNERTUBE_CLIENT = {
  clientName: "ANDROID",
  clientVersion: "19.09.37",
  androidSdkVersion: 30,
  hl: "en",
  gl: "US",
  timeZone: "UTC",
  utcOffsetMinutes: 0,
};

const ANDROID_USER_AGENT =
  "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip";

type Format = {
  itag: number;
  url?: string;
  mimeType: string;
  bitrate: number;
  width?: number;
  height?: number;
  qualityLabel?: string;
  audioChannels?: number;
  audioQuality?: string;
  contentLength?: string;
  signatureCipher?: string;
};

type PlayerResponse = {
  playabilityStatus?: {
    status: string;
    reason?: string;
  };
  videoDetails?: {
    videoId: string;
    title: string;
    author: string;
    lengthSeconds: string;
    viewCount: string;
  };
  streamingData?: {
    formats?: Format[];
    adaptiveFormats?: Format[];
  };
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

function get_extension(mime_type: string): string {
  if (mime_type.includes("mp4")) return "mp4";
  if (mime_type.includes("webm")) return "webm";
  if (mime_type.includes("audio/mp4")) return "m4a";
  return "mp4";
}

function sanitize_filename(title: string): string {
  return title.replace(/[<>:"/\\|?*]/g, "").trim();
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

    const payload = {
      videoId: video_id,
      context: {
        client: INNERTUBE_CLIENT,
      },
      contentCheckOk: true,
      racyCheckOk: true,
    };

    const res = await http_post(INNERTUBE_API_URL, JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": ANDROID_USER_AGENT,
        "X-Youtube-Client-Name": "3",
        "X-Youtube-Client-Version": INNERTUBE_CLIENT.clientVersion,
        ...options.headers,
      },
      timeout: options.timeout ?? 15_000,
    });

    const data = (await res.json()) as PlayerResponse;

    if (data.playabilityStatus?.status !== "OK") {
      throw new ParseError(
        data.playabilityStatus?.reason || "Video not playable",
        "youtube",
      );
    }

    if (!data.streamingData) {
      throw new ParseError("No streaming data available", "youtube");
    }

    const all_formats = [
      ...(data.streamingData.formats || []),
      ...(data.streamingData.adaptiveFormats || []),
    ];

    const urls: MediaItem[] = [];

    // 1. Find best combined format (has both audio and video)
    const combined_formats = all_formats.filter(
      (f) =>
        f.url &&
        f.audioChannels &&
        f.audioChannels > 0 &&
        f.width &&
        f.width > 0,
    );
    combined_formats.sort((a, b) => (b.width || 0) - (a.width || 0));

    if (combined_formats[0]?.url) {
      urls.push({
        type: "video",
        url: combined_formats[0].url,
        filename: `youtube-${video_id}.mp4`,
      });
    }

    // 2. Find best video-only format (for HD quality)
    const video_only_formats = all_formats.filter(
      (f) =>
        f.url &&
        f.width &&
        f.width > 0 &&
        (!f.audioChannels || f.audioChannels === 0) &&
        f.mimeType.includes("video/mp4"), // prefer mp4 for compatibility
    );
    video_only_formats.sort((a, b) => (b.width || 0) - (a.width || 0));

    // 3. Find best audio-only format
    const audio_only_formats = all_formats.filter(
      (f) =>
        f.url &&
        f.audioChannels &&
        f.audioChannels > 0 &&
        (!f.width || f.width === 0) &&
        f.mimeType.includes("audio/mp4"), // prefer m4a for compatibility
    );
    audio_only_formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Add HD video-only if significantly better than combined
    const best_video_only = video_only_formats[0];
    const best_combined = combined_formats[0];
    const has_better_video_only =
      best_video_only?.url &&
      best_video_only.width &&
      (!best_combined || best_video_only.width > (best_combined.width || 0));

    if (has_better_video_only && best_video_only.url) {
      const ext = get_extension(best_video_only.mimeType);
      urls.push({
        type: "video",
        url: best_video_only.url,
        filename: `youtube-${video_id}-video.${ext}`,
      });

      // Add audio-only only if we have video-only (so user can merge them)
      const best_audio = audio_only_formats[0];
      if (best_audio?.url) {
        urls.push({
          type: "audio",
          url: best_audio.url,
          filename: `youtube-${video_id}-audio.m4a`,
        });
      }
    }

    if (urls.length === 0) {
      throw new ParseError("No downloadable formats found", "youtube");
    }

    const title = data.videoDetails?.title || "YouTube video";
    const author = data.videoDetails?.author || "Unknown";

    return {
      urls,
      headers: {},
      meta: {
        title: sanitize_filename(title),
        author,
        platform: "youtube",
        views: data.videoDetails?.viewCount
          ? Number.parseInt(data.videoDetails.viewCount, 10)
          : undefined,
      },
    };
  } catch (e: unknown) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e instanceof Error ? e.message : String(e), "youtube");
  }
}
