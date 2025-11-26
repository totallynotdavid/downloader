import { DownloadOptions } from "@/types";

export function mergeOptions(
  options: DownloadOptions,
): Required<DownloadOptions> {
  return {
    quality: "highest",
    downloadMedia: false,
    preferAudio: false,
    ...options,
  };
}
