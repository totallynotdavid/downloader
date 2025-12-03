import { PlatformNotSupportedError } from "./errors.ts";
import { route } from "./router.ts";
import type { MediaResult, ResolveOptions } from "./types.ts";

export async function resolve(
  url: string,
  options: ResolveOptions = {},
): Promise<MediaResult> {
  const extractor = route(url);

  if (!extractor) {
    throw new PlatformNotSupportedError(url);
  }

  return extractor(url, options);
}
