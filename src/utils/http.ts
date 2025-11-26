import type { Readable } from "node:stream";
import axios from "axios";
import { DEFAULT_TIMEOUT_MS } from "../constants.ts";
import type { MediaItem } from "../types.ts";

/**
 * Creates a readable stream for the given media item.
 * Automatically merges item-specific headers with any global headers provided.
 *
 * @param item - The media item to stream
 * @param globalHeaders - Optional default headers (e.g. from MediaResult)
 */
export async function open_stream(
  item: MediaItem,
  globalHeaders: Record<string, string> = {},
): Promise<Readable> {
  const headers = { ...globalHeaders, ...(item.headers || {}) };

  const response = await axios.get(item.url, {
    headers,
    responseType: "stream",
    timeout: DEFAULT_TIMEOUT_MS * 2,
  });

  return response.data;
}
