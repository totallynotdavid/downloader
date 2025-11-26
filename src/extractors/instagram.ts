import { ExtractionError } from "../errors.ts";
import type { Context, MediaItem, MediaResult } from "../types.ts";

const IG_APP_ID = "936619743392459";
const GRAPHQL_DOC_ID = "8845758582119845";
const USER_AGENT =
  "Instagram 309.0.0.15.109 Android (31/12; 480dpi; 1080x2228; samsung; SM-G996B; t2s; qcom; en_US; 544099989)";
const SHORTCODE_REGEX = /(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;

interface MediaNode {
  is_video: boolean;
  video_url?: string;
  display_url?: string;
  __typename?: string;
  owner?: { username?: string };
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
  edge_sidecar_to_children?: { edges?: Array<{ node: MediaNode }> };
}

function getGraphQLHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/x-www-form-urlencoded",
    "X-IG-App-ID": IG_APP_ID,
    "X-IG-WWW-Claim": "0",
    "X-Requested-With": "XMLHttpRequest",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

function createMediaItem(
  node: MediaNode,
  shortcode: string,
  index: number,
): MediaItem | null {
  const isVideo = node.is_video;
  const mediaUrl = isVideo ? node.video_url : node.display_url;

  if (!mediaUrl) return null;

  const suffix = index > 0 ? `-${index}` : "";
  const extension = isVideo ? "mp4" : "jpg";

  return {
    type: isVideo ? "video" : "image",
    url: mediaUrl,
    filename: `instagram-${shortcode}${suffix}.${extension}`,
  };
}

function processMedia(media: MediaNode, shortcode: string): MediaItem[] {
  const type = media.__typename;
  const isCarousel = type === "GraphSidecar" || type === "XDTGraphSidecar";

  if (isCarousel) {
    const edges = media.edge_sidecar_to_children?.edges || [];
    return edges
      .map(
        (edge, i) => edge?.node && createMediaItem(edge.node, shortcode, i + 1),
      )
      .filter((item): item is MediaItem => item !== null);
  }

  const item = createMediaItem(media, shortcode, 0);
  return item ? [item] : [];
}

export default async function resolve(
  url: string,
  ctx: Context,
): Promise<MediaResult> {
  const match = url.match(SHORTCODE_REGEX);
  if (!match?.[1]) {
    throw new ExtractionError("Could not parse post shortcode", "instagram");
  }
  const shortcode = match[1];

  const params = new URLSearchParams({
    doc_id: GRAPHQL_DOC_ID,
    variables: JSON.stringify({ shortcode }),
  });

  const response = await ctx.http.post(
    "https://www.instagram.com/graphql/query",
    params,
    { headers: getGraphQLHeaders() },
  );

  const data = response.data?.data?.xdt_shortcode_media;
  if (!data) {
    throw new ExtractionError("No media data found", "instagram");
  }

  const items = processMedia(data, shortcode);
  if (items.length === 0) {
    throw new ExtractionError("No media found", "instagram");
  }

  const caption = data.edge_media_to_caption?.edges?.[0]?.node?.text;
  const username = data.owner?.username;

  return {
    urls: items,
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.instagram.com/",
    },
    meta: {
      platform: "instagram",
      title: caption || "Instagram post",
      author: username || "Unknown",
    },
  };
}
