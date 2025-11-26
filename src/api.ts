import { create_context } from "./context.ts";
import { PlatformNotSupportedError } from "./errors.ts";
import { route } from "./router.ts";
import type { MediaResult, ResolveOptions } from "./types.ts";

/**
 * Resolves a social media URL to a direct media link and metadata.
 * Does NOT download the file; use `open_stream` or fetch the `url` manually.
 *
 * @param url - The public URL of the post
 * @param options - Configuration for the HTTP client (proxy, timeout)
 */
export async function resolve(
  url: string,
  options?: ResolveOptions,
): Promise<MediaResult> {
  const extractor = await route(url);

  if (!extractor) {
    throw new PlatformNotSupportedError(url);
  }

  const ctx = create_context(options);

  return extractor(url, ctx);
}
