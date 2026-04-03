import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const HYDRATION_DATA_REGEX =
  /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/;

const EMBED_STATE_REGEX =
  /<script id="__FRONTITY_CONNECT_STATE__" type="application\/json">([\s\S]*?)<\/script>/;

type TiktokMediaPayload = {
  id?: string;
  desc?: string;
  author?: { nickname?: string; uniqueId?: string };
  stats?: { diggCount?: number; playCount?: number };
  covers?: string[];
  coversOrigin?: string[];
  coversDynamic?: string[];
  imagePost?: { images?: Array<{ imageURL?: { urlList?: string[] } }> };
  music?: { playUrl?: string };
  video?: {
    playAddr?: string;
    bitrateInfo?: Array<{ PlayAddr?: { UrlList?: string[] } }>;
  };
};

type ParsedPayload = {
  item?: TiktokMediaPayload;
  title?: string;
};

function parse_hydration_media(html: string): ParsedPayload {
  const match = html.match(HYDRATION_DATA_REGEX);
  if (!match?.[1]) {
    return {};
  }

  const json = JSON.parse(match[1]) as {
    __DEFAULT_SCOPE__?: {
      "webapp.video-detail"?: {
        itemInfo?: { itemStruct?: TiktokMediaPayload };
        shareMeta?: { desc?: string };
      };
    };
  };

  const details = json.__DEFAULT_SCOPE__?.["webapp.video-detail"];
  return {
    item: details?.itemInfo?.itemStruct,
    title: details?.shareMeta?.desc,
  };
}

function parse_embed_media(html: string, id: string): ParsedPayload {
  const match = html.match(EMBED_STATE_REGEX);
  if (!match?.[1]) {
    return {};
  }

  const json = JSON.parse(match[1]) as {
    source?: {
      data?: Record<
        string,
        {
          videoData?: {
            itemInfos?: {
              id?: string;
              text?: string;
              diggCount?: number;
              playCount?: number;
              covers?: string[];
              coversOrigin?: string[];
              coversDynamic?: string[];
              authorInfos?: { nickName?: string; uniqueId?: string };
              video?: { urls?: string[] };
              musicInfos?: { playUrl?: string[] };
              imagePostInfo?: {
                displayImages?: Array<{ urlList?: string[] }>;
              };
            };
          };
        }
      >;
    };
  };

  const data = json.source?.data || {};
  const key = Object.keys(data).find((k) => k.startsWith(`/embed/v2/${id}`));
  const item_infos = key ? data[key]?.videoData?.itemInfos : undefined;

  if (!item_infos) {
    return {};
  }

  return {
    item: {
      id: item_infos.id,
      desc: item_infos.text,
      covers: item_infos.covers,
      coversOrigin: item_infos.coversOrigin,
      coversDynamic: item_infos.coversDynamic,
      author: {
        nickname: item_infos.authorInfos?.nickName,
        uniqueId: item_infos.authorInfos?.uniqueId,
      },
      stats: {
        diggCount: item_infos.diggCount,
        playCount: item_infos.playCount,
      },
      music: {
        playUrl: item_infos.musicInfos?.playUrl?.[0],
      },
      video: {
        playAddr: item_infos.video?.urls?.[0],
      },
      imagePost: {
        images: item_infos.imagePostInfo?.displayImages?.map((img) => ({
          imageURL: { urlList: img.urlList },
        })),
      },
    },
    title: item_infos.text,
  };
}

function parse_embed_photomode_urls(html: string): string[] {
  const matches =
    html.match(/https:\/\/[^"\s]+tplv-photomode-image[^"\s]*/g) || [];
  const urls = matches
    .map((url) => url.replaceAll("\\u0026", "&").replaceAll("&amp;", "&"))
    .filter((url) => url.includes("x-signature="));
  return [...new Set(urls)];
}

function has_primary_media(item: TiktokMediaPayload): boolean {
  return Boolean(get_video_url(item) || get_image_urls(item).length > 0);
}

function get_video_url(item: TiktokMediaPayload): string | undefined {
  const bitrate_info = item.video?.bitrateInfo || [];
  return bitrate_info.length > 0
    ? bitrate_info[0].PlayAddr?.UrlList?.[0]
    : item.video?.playAddr;
}

function get_image_urls(item: TiktokMediaPayload): string[] {
  const urls = [
    ...(item.imagePost?.images
      ?.map((img) => img.imageURL?.urlList?.[0])
      .filter(Boolean) || []),
    ...(item.covers || []),
    ...(item.coversOrigin || []),
    ...(item.coversDynamic || []),
  ];
  return [...new Set(urls)];
}

function build_result_urls(
  item: TiktokMediaPayload,
  embed_photomode_urls: string[],
): MediaResult["urls"] {
  const result_urls: MediaResult["urls"] = [];
  const video_url = get_video_url(item);
  const image_urls = [
    ...new Set([...get_image_urls(item), ...embed_photomode_urls]),
  ];

  if (image_urls.length > 0 && !video_url) {
    image_urls.forEach((direct_url, index) => {
      result_urls.push({
        type: "image",
        url: direct_url,
        filename: `tiktok-${item.id}-${index + 1}.jpg`,
      });
    });

    if (item.music?.playUrl) {
      result_urls.push({
        type: "audio",
        url: item.music.playUrl,
        filename: `tiktok-${item.id}-audio.mp3`,
      });
    }
    return result_urls;
  }

  if (video_url) {
    result_urls.push({
      type: "video",
      url: video_url,
      filename: `tiktok-${item.id}.mp4`,
    });
  }

  return result_urls;
}

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const post_id = url.match(/\/(?:video|photo)\/(\d+)/)?.[1];
  if (!post_id) {
    throw new ParseError("Could not parse TikTok post id", "tiktok");
  }

  const target_urls = [url, `https://www.tiktok.com/embed/v2/${post_id}`];

  try {
    let item: TiktokMediaPayload | undefined;
    let title: string | undefined;
    const embed_photomode_urls: string[] = [];

    for (const target_url of target_urls) {
      const response = await http_get(target_url, options);
      const html = await response.text();

      if (target_url.includes("/embed/v2/")) {
        embed_photomode_urls.push(...parse_embed_photomode_urls(html));
      }

      const hydration = parse_hydration_media(html);
      if (hydration.item && has_primary_media(hydration.item)) {
        item = hydration.item;
        title = hydration.title;
        break;
      }

      const embed = parse_embed_media(html, post_id);
      if (embed.item && has_primary_media(embed.item)) {
        item = embed.item;
        title = embed.title;
        break;
      }
    }

    if (!item) {
      throw new ParseError("Metadata not found", "tiktok");
    }

    const result_urls = build_result_urls(item, embed_photomode_urls);
    if (result_urls.length === 0) {
      throw new ParseError("No media content found", "tiktok");
    }

    return {
      urls: result_urls,
      headers: {
        Referer: "https://www.tiktok.com/",
      },
      meta: {
        title: title || item.desc || "TikTok Post",
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
