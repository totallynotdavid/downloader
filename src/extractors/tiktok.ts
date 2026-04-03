import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const EMBED_STATE_REGEX =
  /<script id="__FRONTITY_CONNECT_STATE__" type="application\/json">([\s\S]*?)<\/script>/;

type TiktokMediaPayload = {
  id?: string;
  desc?: string;
  author?: { nickname?: string; uniqueId?: string };
  stats?: { diggCount?: number; playCount?: number };
  covers?: string[];
  imagePost?: { images?: Array<{ imageURL?: { urlList?: string[] } }> };
  music?: { playUrl?: string };
  video?: {
    playAddr?: string;
    bitrateInfo?: Array<{ PlayAddr?: { UrlList?: string[] } }>;
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

  const json = JSON.parse(match[1]) as any;
  const data = json.source?.data || {};
  const key = Object.keys(data).find((k) =>
    k.startsWith(`/embed/v2/${post_id}`),
  );
  const info = key ? data[key]?.videoData?.itemInfos : undefined;
  if (!info) return undefined;

  const item: TiktokMediaPayload = {
    ...(info.id && { id: info.id }),
    ...(info.text && { desc: info.text }),
    ...(info.covers && { covers: info.covers }),
    ...(info.video?.urls?.[0] && { video: { playAddr: info.video.urls[0] } }),
    ...(info.musicInfos?.playUrl?.[0] && {
      music: { playUrl: info.musicInfos.playUrl[0] },
    }),
  };

  const images = info.imagePostInfo?.displayImages?.map((img: any) => ({
    imageURL: { urlList: img.urlList },
  }));
  if (images?.length) item.imagePost = { images };

  if (info.authorInfos?.nickName || info.authorInfos?.uniqueId) {
    item.author = {
      ...(info.authorInfos.nickName && { nickname: info.authorInfos.nickName }),
      ...(info.authorInfos.uniqueId && { uniqueId: info.authorInfos.uniqueId }),
    };
  }

  if (info.diggCount !== undefined || info.playCount !== undefined) {
    item.stats = {
      ...(info.diggCount !== undefined && { diggCount: info.diggCount }),
      ...(info.playCount !== undefined && { playCount: info.playCount }),
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

    const meta = {
      title: item.desc || "TikTok Post",
      author: item.author?.nickname || item.author?.uniqueId || "Unknown",
      platform: "tiktok",
      ...(item.stats?.diggCount && { likes: item.stats.diggCount }),
      ...(item.stats?.playCount && { views: item.stats.playCount }),
    } as {
      title: string;
      author: string;
      platform: string;
      likes?: number;
      views?: number;
    };

    return {
      urls,
      headers: { Referer: "https://www.tiktok.com/" },
      meta,
    };
  } catch (e: any) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "tiktok");
  }
}
