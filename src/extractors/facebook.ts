import { ExtractionError } from "../errors.ts";
import type { Context, MediaItem, MediaResult } from "../types.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function decodeUnicode(text: string): string {
  try {
    // Handle unicode escapes like \u003C and surrogate pairs
    return text
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
      .replace(/\\\//g, "/");
  } catch {
    return text;
  }
}

function extractText(text: string, start: string, end: string): string {
  const startIdx = text.indexOf(start);
  if (startIdx === -1) return "";
  const from = startIdx + start.length;
  const endIdx = text.indexOf(end, from);
  if (endIdx === -1) return "";
  return text.slice(from, endIdx);
}

function parseVideoPage(html: string): {
  videoUrls: Record<string, string>;
  audioUrl: string;
  videoId: string;
  username: string;
} {
  const videoId = extractText(html, '\\"video_id\\":\\"', '\\"');
  const username = decodeUnicode(
    extractText(html, '"actors":[{"__typename":"User","name":"', '","'),
  );

  const videoSection = extractText(
    html,
    '"permalink_url"',
    "\\/Period>\\u003C\\/MPD>",
  );

  // extract audio URL
  const audioSection = extractText(
    videoSection,
    "AudioChannelConfiguration",
    "BaseURL>\\u003C",
  );
  const audioUrl = decodeUnicode(
    extractText(audioSection, "BaseURL>", "\\u003C\\/"),
  );

  // extract video URLs with resolutions
  const videoUrls: Record<string, string> = {};
  const parts = videoSection.split('FBQualityLabel=\\"');
  for (let i = 1; i < parts.length; i++) {
    const resolution = parts[i].split('\\"', 1)[0];
    const urlPart = parts[i].split("BaseURL>", 2)[1];
    if (urlPart) {
      const url = decodeUnicode(urlPart.split("\\u003C\\/BaseURL>", 1)[0]);
      if (url) {
        videoUrls[resolution] = url;
      }
    }
  }

  return { videoUrls, audioUrl, videoId, username };
}

function parsePhotoPage(html: string): {
  photoUrl: string;
  photoId: string;
  username: string;
} {
  const photoId = extractText(html, '"__isNode":"Photo","id":"', '"');
  const username = decodeUnicode(
    extractText(html, '"owner":{"__typename":"User","name":"', '"'),
  );
  const photoUrl = decodeUnicode(extractText(html, ',"image":{"uri":"', '","'));

  return { photoUrl, photoId, username };
}

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  try {
    const response = await ctx.http.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
    });

    const html = response.data;

    if (typeof html !== "string") {
      throw new Error("Invalid response from Facebook");
    }

    const isVideo = html.includes('\\"video_id\\":\\"');
    const urls: MediaItem[] = [];

    if (isVideo) {
      const { videoUrls, audioUrl, videoId, username } = parseVideoPage(html);

      if (Object.keys(videoUrls).length === 0) {
        throw new Error("No video URLs found");
      }

      // get highest quality video
      const maxResolution = Object.keys(videoUrls)
        .map((r) => Number.parseInt(r.replace(/\D/g, ""), 10) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
      const bestQuality = Object.keys(videoUrls).find((k) =>
        k.includes(String(maxResolution)),
      );
      const videoUrl = bestQuality
        ? videoUrls[bestQuality]
        : Object.values(videoUrls)[0];

      urls.push({
        type: "video",
        url: videoUrl,
        filename: `fb-${videoId || Date.now()}.mp4`,
      });

      if (audioUrl) {
        urls.push({
          type: "audio",
          url: audioUrl,
          filename: `fb-${videoId || Date.now()}.m4a`,
        });
      }

      return {
        urls,
        headers: { "User-Agent": USER_AGENT },
        meta: {
          title: "Facebook Video",
          author: username || "Unknown",
          platform: "facebook",
        },
      };
    }

    // handle photo
    const { photoUrl, photoId, username } = parsePhotoPage(html);

    if (!photoUrl) {
      throw new Error("No photo URL found");
    }

    return {
      urls: [
        {
          type: "image",
          url: photoUrl,
          filename: `fb-${photoId || Date.now()}.jpg`,
        },
      ],
      headers: { "User-Agent": USER_AGENT },
      meta: {
        title: "Facebook Photo",
        author: username || "Unknown",
        platform: "facebook",
      },
    };
  } catch (e: any) {
    throw new ExtractionError(
      e.message || "Failed to extract Facebook media",
      "facebook",
    );
  }
}
