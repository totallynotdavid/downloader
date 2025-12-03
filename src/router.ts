import instagram from "./extractors/instagram.ts";
import tiktok from "./extractors/tiktok.ts";
import facebook from "./extractors/facebook.ts";
import twitter from "./extractors/twitter.ts";
import youtube from "./extractors/youtube.ts";
import reddit from "./extractors/reddit.ts";
import imgur from "./extractors/imgur.ts";
import pinterest from "./extractors/pinterest.ts";
import type { MediaResult, ResolveOptions } from "./types.ts";

type ExtractorFn = (
  url: string,
  options: ResolveOptions,
) => Promise<MediaResult>;

const EXTRACTORS = new Map<string, ExtractorFn>([
  ["instagram.com", instagram],
  ["tiktok.com", tiktok],
  ["facebook.com", facebook],
  ["fb.com", facebook],
  ["twitter.com", twitter],
  ["x.com", twitter],
  ["youtube.com", youtube],
  ["youtu.be", youtube],
  ["reddit.com", reddit],
  ["redd.it", reddit],
  ["imgur.com", imgur],
  ["i.imgur.com", imgur],
  ["pinterest.com", pinterest],
]);

export function route(url: string): ExtractorFn | null {
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  if (EXTRACTORS.has(hostname)) {
    return EXTRACTORS.get(hostname)!;
  }

  if (hostname.endsWith(".pinterest.com")) {
    return pinterest;
  }

  return null;
}
