export class PlatformNotSupportedError extends Error {
  constructor(url: string) {
    super(`No extractor found for URL: ${url}`);
    this.name = "PlatformNotSupportedError";
  }
}

export class NetworkError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NetworkError";
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
  }
}

export class ParseError extends Error {
  public readonly platform: string;

  constructor(message: string, platform: string) {
    super(`[${platform}] ${message}`);
    this.name = "ParseError";
    this.platform = platform;
  }
}
