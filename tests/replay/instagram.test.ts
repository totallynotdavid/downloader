// Instagram account listing and failure modes. Listings replay cassettes like
// the extractor suite. Failure modes cannot be summoned on demand from a live
// host, so those tests answer fetch with the response shapes Instagram sends.

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { listInstagramPosts } from "../../src/extractors/instagram-posts.ts";
import {
  BlockedError,
  NetworkError,
  ParseError,
  resolve,
} from "../../src/index.ts";
import { type ListingOutcome, run_listings } from "../support/runner.ts";
import { install_replay } from "../support/transport.ts";

const listings = new Map<string, ListingOutcome>();
let uninstall: () => void;

beforeAll(async () => {
  uninstall = install_replay();
  for (const outcome of await run_listings())
    listings.set(outcome.label, outcome);
});

afterAll(() => uninstall?.());

function listing(label: string): Required<ListingOutcome> {
  const outcome = listings.get(label);
  expect(outcome?.error).toBeUndefined();
  return outcome as Required<ListingOutcome>;
}

describe("account listing", () => {
  test("collabs snapshot", () => {
    const { ok, pages, more } = listing("instagram/collabs");
    expect({ ok, pages, more }).toMatchSnapshot();
  });

  test("detail snapshot", () => {
    const { ok, pages, more } = listing("instagram/images");
    expect({ ok, pages, more }).toMatchSnapshot();
  });

  test("pages are 12 posts and do not overlap", () => {
    const [first, second] = listing("instagram/collabs").pages;
    expect(first).toHaveLength(12);
    expect(second).toHaveLength(12);
    const codes = new Set(first?.map((p) => p.shortcode));
    expect(second?.some((p) => codes.has(p.shortcode))).toBe(false);
  });

  test("collab posts keep their own author", () => {
    const authors = new Set(
      listing("instagram/collabs")
        .pages.flat()
        .map((p) => p.author),
    );
    expect(authors.has("uni_oficial")).toBe(true);
    expect(authors.size).toBeGreaterThan(1);
  });

  test("urls are canonical", () => {
    for (const post of listing("instagram/collabs").pages.flat()) {
      expect(post.url).toMatch(
        new RegExp(
          `^https://www\\.instagram\\.com/(p|reel)/${post.shortcode}/$`,
        ),
      );
    }
  });

  test("plain listing has no media or timestamp", () => {
    for (const post of listing("instagram/collabs").pages.flat()) {
      expect(post.media).toBeUndefined();
      expect(post.timestamp).toBeUndefined();
    }
  });

  test("detail listing has media and a timestamp for every post", () => {
    for (const post of listing("instagram/images").pages.flat()) {
      expect(post.media?.length).toBeGreaterThan(0);
      expect(post.timestamp).toBeGreaterThan(1_700_000_000);
    }
  });

  test("rejects a malformed username and cursor", async () => {
    await expect(listInstagramPosts("not a user")).rejects.toThrow(ParseError);
    await expect(
      listInstagramPosts("gft.unmsm", { cursor: "garbage" }),
    ).rejects.toThrow(ParseError);
  });
});

const POST_URL = "https://www.instagram.com/p/DcepzLhTqxC/";
function respond(body: string | null, init?: ResponseInit) {
  globalThis.fetch = (async () =>
    new Response(body, init)) as unknown as typeof fetch;
}

function respond_json(json: unknown, init?: ResponseInit) {
  respond(JSON.stringify(json), init);
}

describe("failures are typed errors", () => {
  let installed: typeof fetch;
  beforeEach(() => {
    installed = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = installed;
  });

  test("a 302 to the login page is BlockedError", async () => {
    respond(null, {
      status: 302,
      headers: { location: "https://www.instagram.com/accounts/login/" },
    });
    await expect(listInstagramPosts("gft.unmsm")).rejects.toThrow(BlockedError);
    await expect(resolve(POST_URL)).rejects.toThrow(BlockedError);
  });

  test("HTTP 401 and 429 are BlockedError", async () => {
    for (const status of [401, 429]) {
      respond("{}", { status });
      await expect(resolve(POST_URL)).rejects.toThrow(BlockedError);
    }
  });

  test("a login wall is BlockedError", async () => {
    respond_json({ status: "fail", require_login: true });
    await expect(listInstagramPosts("gft.unmsm")).rejects.toThrow(BlockedError);
  });

  test("a rate limit error code is BlockedError", async () => {
    respond_json({ data: null, errors: [{ code: 1675004 }] });
    await expect(listInstagramPosts("gft.unmsm")).rejects.toThrow(BlockedError);
  });

  test("a gated post is BlockedError", async () => {
    respond_json({
      data: { xig_polaris_media: { if_not_gated_logged_out: null } },
    });
    await expect(resolve(POST_URL)).rejects.toThrow(BlockedError);
  });

  test("an empty response is ParseError", async () => {
    respond("");
    await expect(listInstagramPosts("gft.unmsm")).rejects.toThrow(ParseError);
    await expect(resolve(POST_URL)).rejects.toThrow(ParseError);
  });

  test("a rejected request names the stale query id", async () => {
    respond(
      'for (;;);{"__ar":1,"error":1357054,"errorSummary":"Your Request Couldn\'t be Processed"}',
    );
    await expect(resolve(POST_URL)).rejects.toThrow(/stale/);
  });

  test("an unexpected shape is ParseError, not an empty list", async () => {
    respond_json({ data: { xig_user_by_username: { id: "1" } } });
    await expect(listInstagramPosts("gft.unmsm")).rejects.toThrow(ParseError);
  });

  test("an unknown account is NetworkError 404", async () => {
    respond_json({ data: { xig_user_by_username: null } });
    const error = await listInstagramPosts("gft.unmsm").catch((e) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.statusCode).toBe(404);
  });

  test("a missing post is NetworkError 404", async () => {
    respond_json({ data: { xig_polaris_media: null } });
    const error = await resolve(POST_URL).catch((e) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.statusCode).toBe(404);
  });
});
