import axios from "axios";
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT } from "./constants";
import { NetworkError } from "./errors";
import type { Context, ResolveOptions } from "./types";

export function create_context(options: ResolveOptions = {}): Context {
  const http = axios.create({
    timeout: options.timeout || DEFAULT_TIMEOUT_MS,
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  http.interceptors.response.use(
    (response) => response,
    (error) => {
      const msg = error.response
        ? `HTTP ${error.response.status}: ${error.response.statusText}`
        : error.message;
      return Promise.reject(new NetworkError(msg));
    },
  );

  return {
    http,
    options,
  };
}
