import { http_post } from "../http.ts";
import { BlockedError, NetworkError, ParseError } from "../errors.ts";
import type { ResolveOptions } from "../types.ts";

// Instagram rejects stale document IDs for anonymous web queries.
export const QUERIES = {
  post: {
    doc_id: "27130156389949648",
    name: "PolarisLoggedOutDesktopWWWPostRootContentQuery",
  },
  profile_posts: {
    doc_id: "27553725110923321",
    name: "PolarisLoggedOutDesktopWWWProfilePostsTabContentQuery",
  },
  profile_posts_page: {
    doc_id: "27389614800735091",
    name: "PolarisLoggedOutDesktopWWWProfilePostsTabContentQuery_connection",
  },
} as const;

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const ENDPOINT = "https://www.instagram.com/api/graphql";
const IG_APP_ID = "936619743392459";
// Instagram accepts any value. Fixed values keep request bodies replayable.
const LSD = "AVqbxe3J_YA";
const CSRF_TOKEN = "Pl3a7Kd9sVqXwT2mRn5uYc8bHg1fEz0o";

const BLOCKED_STATUSES = new Set([302, 401, 403, 429]);
const ERROR_NOT_FOUND = 4630001;
const ERROR_RATE_LIMITED = 1675004;

type GraphqlResponse = {
  status?: string;
  require_login?: boolean;
  error?: number;
  errorSummary?: string;
  data?: Record<string, unknown> | null;
  errors?: Array<{ code?: number; message?: string }>;
};

function parse_body(text: string): GraphqlResponse {
  if (!text.trim()) {
    throw new ParseError("Empty response", "instagram");
  }
  try {
    return JSON.parse(text.replace(/^for \(;;\);/, "")) as GraphqlResponse;
  } catch {
    throw new ParseError("Response is not JSON", "instagram");
  }
}

export async function graphql(
  query: { doc_id: string; name: string },
  variables: Record<string, unknown>,
  options: ResolveOptions,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    av: "0",
    __d: "www",
    __user: "0",
    __a: "1",
    __hs: "20681.HYP:instagram_web_pkg.2.1...0",
    dpr: "1",
    __ccg: "EXCELLENT",
    __rev: "1045311908",
    __hsi: "7674722996112187910",
    __comet_req: "7",
    lsd: LSD,
    __spin_r: "1045311908",
    __spin_b: "trunk",
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: query.name,
    server_timestamps: "true",
    variables: JSON.stringify(variables),
    doc_id: query.doc_id,
  });

  let text: string;
  try {
    const response = await http_post(ENDPOINT, body, {
      redirect: "manual",
      ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
      headers: {
        Accept: "*/*",
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-CSRFToken": CSRF_TOKEN,
        "X-FB-Friendly-Name": query.name,
        "X-FB-LSD": LSD,
        "X-IG-App-ID": IG_APP_ID,
        ...options.headers,
      },
    });
    text = await response.text();
  } catch (e: unknown) {
    if (e instanceof NetworkError && BLOCKED_STATUSES.has(e.statusCode ?? 0)) {
      throw new BlockedError(
        `Instagram refused the request (${e.message}). Datacenter IPs are blocked far more often than residential ones.`,
        e.statusCode,
      );
    }
    throw e;
  }

  const json = parse_body(text);

  if (json.status === "fail" && json.require_login) {
    throw new BlockedError("Instagram requires login for this request", 401);
  }
  if (json.error) {
    throw new ParseError(
      `Instagram rejected the request (${json.error}: ${json.errorSummary ?? "unknown"}), the query id may be stale`,
      "instagram",
    );
  }
  if (!json.data) {
    const codes = (json.errors ?? []).map((e) => e.code);
    if (codes.includes(ERROR_NOT_FOUND)) {
      throw new NetworkError("Instagram: not found", 404);
    }
    if (codes.includes(ERROR_RATE_LIMITED)) {
      throw new BlockedError("Instagram rate limited the request", 429);
    }
    throw new ParseError(
      "No data in response, the query id may be stale",
      "instagram",
    );
  }
  return json.data;
}
