import type { ExtractorFn } from "./types";

type RouteDefinition = [RegExp, () => Promise<{ default: ExtractorFn }>];

/**
 * The routing table.
 * Order matters: generic matchers should go last.
 * Modules are lazy-loaded only when a regex matches.
 */
const routes: RouteDefinition[] = [
  [/instagram\.com/, () => import("./extractors/instagram")],
  [/tiktok\.com/, () => import("./extractors/tiktok")],
  [/(facebook|fb)\.com/, () => import("./extractors/facebook")],
  [/(twitter\.com|x\.com)/, () => import("./extractors/twitter")],
  [/(youtube\.com|youtu\.be)/, () => import("./extractors/youtube")],
  [/(reddit\.com|redd\.it)/, () => import("./extractors/reddit")],
  [/imgur\.com/, () => import("./extractors/imgur")],
  [/pinterest\.com/, () => import("./extractors/pinterest")],
];

export async function route(url: string): Promise<ExtractorFn | null> {
  for (const [pattern, loader] of routes) {
    if (pattern.test(url)) {
      const module = await loader();
      return module.default;
    }
  }
  return null;
}
