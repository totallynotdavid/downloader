import { afterAll, beforeAll, expect, test } from "bun:test";
import { NetworkError } from "../../src/errors.ts";
import { http_get, http_post } from "../../src/http.ts";

let server: ReturnType<typeof Bun.serve>;
let origin: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/stall") {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("{"));
            },
          }),
        );
      }
      return Response.json({
        userAgent: request.headers.get("user-agent"),
        contentType: request.headers.get("content-type"),
      });
    },
  });
  origin = `http://localhost:${server.port}`;
});

afterAll(() => server.stop(true));

test("a caller header replaces the default whatever its case", async () => {
  const get = await http_get(origin, { headers: { "user-agent": "mine" } });
  expect(((await get.json()) as { userAgent: string }).userAgent).toBe("mine");

  const post = await http_post(origin, "{}", {
    headers: { "content-type": "text/plain" },
  });
  expect(((await post.json()) as { contentType: string }).contentType).toBe(
    "text/plain",
  );
});

test("the timeout covers a body that never finishes", async () => {
  const error = await http_get(`${origin}/stall`, { timeout: 200 }).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(NetworkError);
  expect((error as NetworkError).statusCode).toBe(408);
});
