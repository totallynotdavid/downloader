import { NetworkError } from "./errors.ts";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT = 10_000;

type FetchOptions = {
  headers?: Record<string, string>;
  timeout?: number;
};

type PostOptions = FetchOptions & {
  // "manual" turns a redirect into a thrown NetworkError instead of following it.
  redirect?: "manual";
};

async function send(
  url: string,
  init: RequestInit,
  timeout_ms: number | undefined,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeout_ms ?? DEFAULT_TIMEOUT,
  );

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    if (!res.ok) {
      throw new NetworkError(
        `HTTP ${res.status}: ${res.statusText}`,
        res.status,
      );
    }

    return res;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new NetworkError("Request timeout", 408);
    }
    if (e instanceof NetworkError) throw e;
    const message = e instanceof Error ? e.message : "Unknown error";
    throw new NetworkError(message);
  } finally {
    clearTimeout(timeout);
  }
}

export function http_get(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  return send(
    url,
    {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
        ...options.headers,
      },
    },
    options.timeout,
  );
}

export function http_post(
  url: string,
  body: string | URLSearchParams,
  options: PostOptions = {},
): Promise<Response> {
  return send(
    url,
    {
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
      ...(options.redirect ? { redirect: options.redirect } : {}),
    },
    options.timeout,
  );
}
