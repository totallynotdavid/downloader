export class PlatformNotSupportedError extends Error {
  constructor(message?: string) {
    super(message || "Platform not supported.");
    this.name = "PlatformNotSupportedError";
    Object.setPrototypeOf(this, PlatformNotSupportedError.prototype);
  }
}

export class MediaNotFoundError extends Error {
  constructor(message?: string) {
    super(message || "Media not found.");
    this.name = "MediaNotFoundError";
    Object.setPrototypeOf(this, MediaNotFoundError.prototype);
  }
}

export class DownloadError extends Error {
  constructor(message?: string) {
    super(message || "Download error.");
    this.name = "DownloadError";
    Object.setPrototypeOf(this, DownloadError.prototype);
  }
}

export class RateLimitError extends Error {
  constructor(message?: string) {
    super(message || "Rate limit exceeded.");
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
