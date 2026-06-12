import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const EMBED_STATE_REGEX =
  /<script id="__FRONTITY_CONNECT_STATE__" type="application\/json">([\s\S]*?)<\/script>/;

type TiktokMediaPayload = {
  id?: string;
  desc?: string;
  author?: { nickname?: string; uniqueId?: string };
  stats?: {
    diggCount?: number;
    playCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
  createTime?: number | string;
  covers?: string[];
  imagePost?: { images?: Array<{ imageURL?: { urlList?: string[] } }> };
  music?: { playUrl?: string };
  video?: {
    playAddr?: string;
    bitrateInfo?: Array<{ PlayAddr?: { UrlList?: string[] } }>;
  };
};

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
): TiktokMediaPayload | undefined {
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

  // authorInfos lives at the videoData level, not inside itemInfos; fall back to
  // the itemInfos copy for older embed payloads.
  const author_infos = video_data?.authorInfos ?? info.authorInfos;

  const play_addr = info.video?.urls?.[0];
  const music_url = info.musicInfos?.playUrl?.[0];
  const item: TiktokMediaPayload = {
    ...(info.id && { id: info.id }),
    ...(info.text && { desc: info.text }),
    ...(info.covers && { covers: info.covers }),
    ...(play_addr && { video: { playAddr: play_addr } }),
    ...(music_url && { music: { playUrl: music_url } }),
    ...(info.createTime !== undefined && { createTime: info.createTime }),
  };

  const images = info.imagePostInfo?.displayImages?.map((img) => ({
    imageURL: { urlList: img.urlList ?? [] },
  }));
  if (images?.length) item.imagePost = { images };

  if (author_infos?.nickName || author_infos?.uniqueId) {
    item.author = {
      ...(author_infos.nickName && { nickname: author_infos.nickName }),
      ...(author_infos.uniqueId && { uniqueId: author_infos.uniqueId }),
    };
  }

  if (
    info.diggCount !== undefined ||
    info.playCount !== undefined ||
    info.commentCount !== undefined ||
    info.shareCount !== undefined
  ) {
    item.stats = {
      ...(info.diggCount !== undefined && { diggCount: info.diggCount }),
      ...(info.playCount !== undefined && { playCount: info.playCount }),
      ...(info.commentCount !== undefined && {
        commentCount: info.commentCount,
      }),
      ...(info.shareCount !== undefined && { shareCount: info.shareCount }),
    };
  }

  return item;
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
    const item = extract_media(html, post_id);

    if (!item) {
      throw new ParseError("Metadata not found", "tiktok");
    }

    const video_url =
      item.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0] ||
      item.video?.playAddr;

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
        ...(item.imagePost?.images
          ?.map((img) => img.imageURL?.urlList?.[0])
          .filter((u): u is string => Boolean(u)) || []),
        ...(item.covers || []),
        ...carousel_images,
      ]),
    ];

    const urls: MediaResult["urls"] = [];
    if (image_urls.length > 0 && !video_url) {
      image_urls.forEach((url, i) => {
        urls.push({
          type: "image",
          url,
          filename: `tiktok-${item.id}-${i + 1}.jpg`,
        });
      });
      if (item.music?.playUrl) {
        urls.push({
          type: "audio",
          url: item.music.playUrl,
          filename: `tiktok-${item.id}-audio.mp3`,
        });
      }
    } else if (video_url) {
      urls.push({
        type: "video",
        url: video_url,
        filename: `tiktok-${item.id}.mp4`,
      });
    }

    if (!urls.length) {
      throw new ParseError("No media content found", "tiktok");
    }

    const meta: MediaResult["meta"] = {
      title: item.desc || "TikTok Post",
      author: item.author?.nickname || item.author?.uniqueId || "Unknown",
      platform: "tiktok",
    };
    if (item.createTime !== undefined) {
      const ts = Number(item.createTime);
      if (Number.isFinite(ts) && ts > 0) meta.timestamp = ts;
    }
    if (item.stats?.diggCount !== undefined) {
      meta.likes = item.stats.diggCount;
    }
    if (item.stats?.playCount !== undefined) {
      meta.views = item.stats.playCount;
    }
    if (item.stats?.commentCount !== undefined) {
      meta.comments = item.stats.commentCount;
    }
    if (item.stats?.shareCount !== undefined) {
      meta.shares = item.stats.shareCount;
    }

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
