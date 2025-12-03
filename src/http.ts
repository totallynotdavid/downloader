import { NetworkError } from "./errors.ts";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT = 10_000;

type FetchOptions = {
  headers?: Record<string, string>;
  timeout?: number;
};

export async function http_get(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout ?? DEFAULT_TIMEOUT,
  );

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new NetworkError(
        `HTTP ${res.status}: ${res.statusText}`,
        res.status,
      );
    }

    return res;
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new NetworkError("Request timeout", 408);
    }
    if (e instanceof NetworkError) throw e;
    throw new NetworkError(e.message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function http_post(
  url: string,
  body: string | URLSearchParams,
  options: FetchOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout ?? DEFAULT_TIMEOUT,
  );

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Content-Type":
          body instanceof URLSearchParams
            ? "application/x-www-form-urlencoded"
            : "application/json",
        ...options.headers,
      },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new NetworkError(
        `HTTP ${res.status}: ${res.statusText}`,
        res.status,
      );
    }

    return res;
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new NetworkError("Request timeout", 408);
    }
    if (e instanceof NetworkError) throw e;
    throw new NetworkError(e.message);
  } finally {
    clearTimeout(timeout);
  }
}
