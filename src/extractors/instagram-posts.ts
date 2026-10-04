import { NetworkError, ParseError } from "../errors.ts";
import type { ListPostsOptions, Post, PostPage } from "../types.ts";
import { fetch_media_node, type MediaNode, media_items } from "./instagram.ts";
import { graphql, QUERIES } from "./instagram-graphql.ts";

const USERNAME_REGEX = /^[A-Za-z0-9._]{1,30}$/;
const PAGE_SIZE = 12;
const DETAIL_CONCURRENCY = 4;

type Connection = {
  edges?: Array<{ node: MediaNode }>;
  page_info?: { has_next_page?: boolean; end_cursor?: string | null };
};

// The cursor carries the account ID so page requests can use the connection API.
function encode_cursor(id: string, after: string): string {
  return `${id}:${after}`;
}

function decode_cursor(cursor: string): { id: string; after: string } {
  const split = cursor.indexOf(":");
  const id = cursor.slice(0, split);
  const after = cursor.slice(split + 1);
  if (split < 1 || !after || !/^\d+$/.test(id)) {
    throw new ParseError("Invalid cursor", "instagram");
  }
  return { id, after };
}

function to_post(node: MediaNode): Post {
  const author = node.user?.username;
  if (!node.code || !author || !node.display_uri) {
    throw new ParseError("Post is missing required fields", "instagram");
  }
  const type =
    node.media_type === 8
      ? "carousel"
      : node.media_type === 2
        ? "video"
        : "image";
  const path = node.product_type === "clips" ? "reel" : "p";
  const post: Post = {
    shortcode: node.code,
    url: `https://www.instagram.com/${path}/${node.code}/`,
    author,
    type,
    thumbnail: node.display_uri,
  };
  if (node.caption?.text) post.caption = node.caption.text;
  return post;
}

async function add_detail(
  posts: Post[],
  options: ListPostsOptions,
): Promise<void> {
  for (let i = 0; i < posts.length; i += DETAIL_CONCURRENCY) {
    await Promise.all(
      posts.slice(i, i + DETAIL_CONCURRENCY).map(async (post) => {
        const node = await fetch_media_node(post.shortcode, options);
        post.media = media_items(node, post.shortcode);
        if (node.taken_at) post.timestamp = node.taken_at;
      }),
    );
  }
}

// Return an empty page for an intact account response with no posts. Reject
// redirects, rate limits, login walls, and malformed responses with typed errors.
export async function listInstagramPosts(
  username: string,
  options: ListPostsOptions = {},
): Promise<PostPage> {
  const handle = username.replace(/^@/, "");
  if (!USERNAME_REGEX.test(handle)) {
    throw new ParseError("Invalid username", "instagram");
  }

  let id: string;
  let connection: Connection | null | undefined;
  if (options.cursor) {
    const cursor = decode_cursor(options.cursor);
    id = cursor.id;
    const data = await graphql(
      QUERIES.profile_posts_page,
      { after: cursor.after, first: PAGE_SIZE, id },
      options,
    );
    const node = data["node"] as {
      polaris_ordered_timeline_connection?: Connection;
    } | null;
    connection = node?.polaris_ordered_timeline_connection;
  } else {
    const data = await graphql(
      QUERIES.profile_posts,
      { first: PAGE_SIZE, username: handle },
      options,
    );
    const user = data["xig_user_by_username"] as
      | { id?: string; polaris_ordered_timeline_connection?: Connection }
      | null
      | undefined;
    if (!user) {
      throw new NetworkError(`Instagram account not found: ${handle}`, 404);
    }
    id = user.id ?? "";
    connection = user.polaris_ordered_timeline_connection;
  }

  if (!connection?.edges || !id) {
    throw new ParseError("Unexpected account response shape", "instagram");
  }

  const posts = connection.edges.map((edge) => to_post(edge.node));
  if (options.detail) await add_detail(posts, options);

  const page: PostPage = { posts };
  const end_cursor = connection.page_info?.end_cursor;
  if (connection.page_info?.has_next_page && end_cursor) {
    page.cursor = encode_cursor(id, end_cursor);
  }
  return page;
}
