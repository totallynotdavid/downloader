export { resolve } from "./resolve.ts";
export { listInstagramPosts } from "./extractors/instagram-posts.ts";

export type {
  MediaResult,
  MediaItem,
  ResolveOptions,
  ListPostsOptions,
  Post,
  PostPage,
} from "./types.ts";

export {
  PlatformNotSupportedError,
  NetworkError,
  BlockedError,
  ParseError,
} from "./errors.ts";
