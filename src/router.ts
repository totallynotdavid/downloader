import type { ExtractorFn } from "./types.ts";

type RouteDefinition = [RegExp, () => Promise<{ default: ExtractorFn }>];

const WWW_REGEX = /^www\./;

/**
 * The routing table.
 * Order matters: generic matchers should go last.
 * Modules are lazy-loaded only when a regex matches.
 */
const routes: RouteDefinition[] = [
  [/^instagram\.com$/, () => import("./extractors/instagram.ts")],
  [/^tiktok\.com$/, () => import("./extractors/tiktok.ts")],
  [/^(facebook|fb)\.com$/, () => import("./extractors/facebook.ts")],
  [/^(twitter\.com|x\.com)$/, () => import("./extractors/twitter.ts")],
  [/^(youtube\.com|youtu\.be)$/, () => import("./extractors/youtube.ts")],
  [/^(reddit\.com|redd\.it)$/, () => import("./extractors/reddit.ts")],
  [/^(i\.)?imgur\.com$/, () => import("./extractors/imgur.ts")],
  [/^([a-z]{2}\.)?pinterest\.com$/, () => import("./extractors/pinterest.ts")],
];

export async function route(url: string): Promise<ExtractorFn | null> {
  const hostname = new URL(url).hostname.replace(WWW_REGEX, "");

  for (const [pattern, loader] of routes) {
    if (pattern.test(hostname)) {
      // biome-ignore lint/performance/noAwaitInLoops: Sequential loading stops on first match, more efficient than Promise.all
      const module = await loader();
      return module.default;
    }
  }

  return null;
}
