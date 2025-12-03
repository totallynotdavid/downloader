export class PlatformNotSupportedError extends Error {
  constructor(url: string) {
    super(`No extractor found for URL: ${url}`);
    this.name = "PlatformNotSupportedError";
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ParseError extends Error {
  constructor(
    message: string,
    public platform: string,
  ) {
    super(`[${platform}] ${message}`);
    this.name = "ParseError";
  }
}
