import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const EMBED_STATE_REGEX =
  /<script id="__FRONTITY_CONNECT_STATE__" type="application\/json">([\s\S]*?)<\/script>/;

type AuthorInfos = { nickName?: string; uniqueId?: string };

type ItemInfos = {
  id?: string;
  text?: string;
  covers?: string[];
  video?: { urls?: string[] };
  musicInfos?: { playUrl?: string[] };
  imagePostInfo?: { displayImages?: Array<{ urlList?: string[] }> };
  authorInfos?: AuthorInfos;
  diggCount?: number;
  playCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTime?: number | string;
};

type EmbedState = {
  source?: {
    data?: Record<
      string,
      { videoData?: { itemInfos?: ItemInfos; authorInfos?: AuthorInfos } }
    >;
  };
};

function normalize_tiktok_url_entities(url: string): string {
  if (url.includes("\\u0026")) {
    return url.replaceAll("\\u0026", "&");
  }
  if (url.includes("&amp;")) {
    return url.replaceAll("&amp;", "&");
  }
  return url;
}

function extract_media(
  html: string,
  post_id: string,
): { info: ItemInfos; author: AuthorInfos | undefined } | undefined {
  const match = html.match(EMBED_STATE_REGEX);
  if (!match?.[1]) return undefined;

  const state = JSON.parse(match[1]) as EmbedState;
  const data = state.source?.data ?? {};
  const key = Object.keys(data).find((k) =>
    k.startsWith(`/embed/v2/${post_id}`),
  );
  const video_data = key ? data[key]?.videoData : undefined;
  const info = video_data?.itemInfos;
  if (!info) return undefined;

  // authorInfos sits beside itemInfos; older embed payloads nest it inside.
  return { info, author: video_data?.authorInfos ?? info.authorInfos };
}

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const post_id = url.match(/\/(?:video|photo)\/(\d+)/)?.[1];
  if (!post_id) {
    throw new ParseError("Could not parse TikTok post id", "tiktok");
  }

  try {
    const embed_url = `https://www.tiktok.com/embed/v2/${post_id}`;
    const html = await http_get(embed_url, options).then((r) => r.text());
    const embed = extract_media(html, post_id);

    if (!embed) {
      throw new ParseError("Metadata not found", "tiktok");
    }
    const { info, author } = embed;

    const video_url = info.video?.urls?.[0];

    const carousel_urls =
      html.match(/https:\/\/[^"\s]+tplv-photomode-image[^"\s]*/g) || [];
    const carousel_images = [
      ...new Set(
        carousel_urls
          .map((u) => normalize_tiktok_url_entities(u))
          .filter((u) => u.includes("x-signature=")),
      ),
    ];

    const image_urls = [
      ...new Set([
        ...(info.imagePostInfo?.displayImages
          ?.map((img) => img.urlList?.[0])
          .filter((u): u is string => Boolean(u)) || []),
        ...(info.covers || []),
        ...carousel_images,
      ]),
    ];

    const urls: MediaResult["urls"] = [];
    const music_url = info.musicInfos?.playUrl?.[0];
    if (image_urls.length > 0 && !video_url) {
      image_urls.forEach((url, i) => {
        urls.push({
          type: "image",
          url,
          filename: `tiktok-${info.id}-${i + 1}.jpg`,
        });
      });
      if (music_url) {
        urls.push({
          type: "audio",
          url: music_url,
          filename: `tiktok-${info.id}-audio.mp3`,
        });
      }
    } else if (video_url) {
      urls.push({
        type: "video",
        url: video_url,
        filename: `tiktok-${info.id}.mp4`,
      });
    }

    if (!urls.length) {
      throw new ParseError("No media content found", "tiktok");
    }

    const meta: MediaResult["meta"] = {
      title: info.text || "TikTok Post",
      author: author?.nickName || author?.uniqueId || "Unknown",
      platform: "tiktok",
    };
    if (info.createTime !== undefined) {
      const ts = Number(info.createTime);
      if (Number.isFinite(ts) && ts > 0) meta.timestamp = ts;
    }
    if (info.diggCount !== undefined) meta.likes = info.diggCount;
    if (info.playCount !== undefined) meta.views = info.playCount;
    if (info.commentCount !== undefined) meta.comments = info.commentCount;
    if (info.shareCount !== undefined) meta.shares = info.shareCount;

    return {
      urls,
      headers: { Referer: "https://www.tiktok.com/" },
      meta,
    };
  } catch (e: unknown) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    const message = e instanceof Error ? e.message : "Unknown error";
    throw new ParseError(message, "tiktok");
  }
}
