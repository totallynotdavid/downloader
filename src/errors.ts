export class PlatformNotSupportedError extends Error {
  constructor(url: string) {
    super(`No extractor found for URL: ${url}`);
    this.name = "PlatformNotSupportedError";
  }
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    public platform: string,
  ) {
    super(`[${platform}] ${message}`);
    this.name = "ExtractionError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}
