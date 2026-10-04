import { BlockedError, NetworkError, ParseError } from "../errors.ts";
import type { MediaItem, MediaResult, ResolveOptions } from "../types.ts";
import { graphql, QUERIES, USER_AGENT } from "./instagram-graphql.ts";

const SHORTCODE_REGEX = /(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
const SHORTCODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

type ImageVersions = { candidates?: Array<{ url?: string }> };

export interface MediaNode {
  pk?: string;
  code?: string;
  media_type?: number;
  product_type?: string;
  taken_at?: number | null;
  like_count?: number;
  comment_count?: number;
  user?: { username?: string };
  caption?: { text?: string } | null;
  display_uri?: string;
  image_versions2?: ImageVersions | null;
  video_versions?: Array<{ url?: string }> | null;
  carousel_media?: MediaNode[] | null;
}

// Use the first image candidate because Instagram orders candidates by size.
function create_media_item(
  node: MediaNode,
  shortcode: string,
  index: number,
): MediaItem | null {
  const video_url = node.video_versions?.[0]?.url;
  const url = video_url ?? node.image_versions2?.candidates?.[0]?.url;
  if (!url) return null;

  const suffix = index > 0 ? `-${index}` : "";
  return {
    type: video_url ? "video" : "image",
    url,
    filename: `instagram-${shortcode}${suffix}.${video_url ? "mp4" : "jpg"}`,
  };
}

export function media_items(node: MediaNode, shortcode: string): MediaItem[] {
  if (node.carousel_media) {
    return node.carousel_media
      .map((child, i) => create_media_item(child, shortcode, i + 1))
      .filter((item): item is MediaItem => item !== null);
  }
  const item = create_media_item(node, shortcode, 0);
  return item ? [item] : [];
}

function shortcode_to_media_id(shortcode: string): string {
  let id = 0n;
  for (const char of shortcode) {
    const digit = SHORTCODE_ALPHABET.indexOf(char);
    if (digit < 0) {
      throw new ParseError("Invalid post shortcode", "instagram");
    }
    id = id * 64n + BigInt(digit);
  }
  return id.toString();
}

export async function fetch_media_node(
  shortcode: string,
  options: ResolveOptions,
): Promise<MediaNode> {
  const data = await graphql(
    QUERIES.post,
    { media_id: shortcode_to_media_id(shortcode) },
    options,
  );
  const media = data["xig_polaris_media"] as
    | { if_not_gated_logged_out?: MediaNode | null }
    | null
    | undefined;

  if (!media) {
    throw new NetworkError("Instagram post not found", 404);
  }
  if (!media.if_not_gated_logged_out) {
    throw new BlockedError("Instagram post requires login to view", 401);
  }
  return media.if_not_gated_logged_out;
}

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const shortcode = url.match(SHORTCODE_REGEX)?.[1];
  if (!shortcode) {
    throw new ParseError("Could not parse post shortcode", "instagram");
  }

  const node = await fetch_media_node(shortcode, options);
  const items = media_items(node, shortcode);
  if (items.length === 0) {
    throw new ParseError("No media found", "instagram");
  }

  const caption = node.caption?.text;
  const meta: MediaResult["meta"] = {
    platform: "instagram",
    title: caption || "Instagram post",
    author: node.user?.username || "Unknown",
  };
  if (caption) meta.description = caption;
  if (node.display_uri) meta.thumbnail = node.display_uri;
  if (node.taken_at) meta.timestamp = node.taken_at;
  if (node.like_count !== undefined) meta.likes = node.like_count;
  if (node.comment_count !== undefined) meta.comments = node.comment_count;

  return {
    urls: items,
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.instagram.com/",
    },
    meta,
  };
}
