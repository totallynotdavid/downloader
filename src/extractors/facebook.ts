import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function decode_unicode(text: string): string {
  try {
    return text
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
      .replace(/\\\//g, "/");
  } catch {
    return text;
  }
}

function extract_text(text: string, start: string, end: string): string {
  const start_idx = text.indexOf(start);
  if (start_idx === -1) return "";
  const from = start_idx + start.length;
  const end_idx = text.indexOf(end, from);
  if (end_idx === -1) return "";
  return text.slice(from, end_idx);
}

function parse_video_page(html: string): {
  video_urls: Record<string, string>;
  audio_url: string;
  video_id: string;
  username: string;
} {
  const video_id = extract_text(html, '\\"video_id\\":\\"', '\\"');
  const username = decode_unicode(
    extract_text(html, '"actors":[{"__typename":"User","name":"', '","'),
  );

  const video_section = extract_text(
    html,
    '"permalink_url"',
    "\\/Period>\\u003C\\/MPD>",
  );

  const audio_section = extract_text(
    video_section,
    "AudioChannelConfiguration",
    "BaseURL>\\u003C",
  );
  const audio_url = decode_unicode(
    extract_text(audio_section, "BaseURL>", "\\u003C\\/"),
  );

  const video_urls: Record<string, string> = {};
  const parts = video_section.split('FBQualityLabel=\\"');
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const resolution = part.split('"', 1)[0];
    if (!resolution) continue;

    const url_part = part.split("BaseURL>", 2)[1];
    if (!url_part) continue;

    const url_segment = url_part.split("\\u003C\\/BaseURL>", 1)[0];
    if (!url_segment) continue;

    const url = decode_unicode(url_segment);
    if (url) {
      video_urls[resolution] = url;
    }
  }

  return { video_urls, audio_url, video_id, username };
}

function parse_photo_page(html: string): {
  photo_url: string;
  photo_id: string;
  username: string;
} {
  const photo_id = extract_text(html, '"__isNode":"Photo","id":"', '"');
  const username = decode_unicode(
    extract_text(html, '"owner":{"__typename":"User","name":"', '"'),
  );
  const photo_url = decode_unicode(
    extract_text(html, ',"image":{"uri":"', '","'),
  );

  return { photo_url, photo_id, username };
}

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  try {
    const response = await http_get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        ...options.headers,
      },
      timeout: options.timeout,
    });

    const html = await response.text();
    const is_video = html.includes('\\"video_id\\":\\"');
    const urls: MediaItem[] = [];

    if (is_video) {
      const { video_urls, audio_url, video_id, username } =
        parse_video_page(html);

      if (Object.keys(video_urls).length === 0) {
        throw new ParseError("No video URLs found", "facebook");
      }

      const max_resolution = Object.keys(video_urls)
        .map((r) => Number.parseInt(r.replace(/\D/g, ""), 10) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
      const best_quality = Object.keys(video_urls).find((k) =>
        k.includes(String(max_resolution)),
      );
      const video_url = best_quality
        ? video_urls[best_quality]
        : Object.values(video_urls)[0];

      if (!video_url) {
        throw new ParseError("Failed to select video URL", "facebook");
      }

      urls.push({
        type: "video",
        url: video_url,
        filename: `fb-${video_id || Date.now()}.mp4`,
      });

      if (audio_url) {
        urls.push({
          type: "audio",
          url: audio_url,
          filename: `fb-${video_id || Date.now()}.m4a`,
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

    const { photo_url, photo_id, username } = parse_photo_page(html);

    if (!photo_url) {
      throw new ParseError("No photo URL found", "facebook");
    }

    return {
      urls: [
        {
          type: "image",
          url: photo_url,
          filename: `fb-${photo_id || Date.now()}.jpg`,
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
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "facebook");
  }
}
