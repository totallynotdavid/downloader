import { http_get } from "../http.ts";
import { NetworkError, ParseError } from "../errors.ts";
import type { MediaResult, ResolveOptions } from "../types.ts";

const PIN_ID_REGEX = /\/pin\/(?:[\w-]+--)?(\d+)/;
const VIDEO_QUALITY_PRIORITY = [
  "V_720P",
  "V_EXP7",
  "V_EXP6",
  "V_EXP5",
  "V_EXP4",
];

export default async function resolve(
  url: string,
  options: ResolveOptions,
): Promise<MediaResult> {
  const match = url.match(PIN_ID_REGEX);
  if (!match?.[1]) {
    throw new ParseError("Could not extract pin ID from URL", "pinterest");
  }
  const pin_id = match[1];

  try {
    const api_url =
      "https://www.pinterest.com/resource/PinResource/get/?data=" +
      encodeURIComponent(
        JSON.stringify({
          options: { field_set_key: "unauth_react_main_pin", id: pin_id },
        }),
      );

    const response = await http_get(api_url, {
      headers: {
        "X-Pinterest-PWS-Handler": "www/[username].js",
        ...options.headers,
      },
      timeout: options.timeout,
    });

    const json = (await response.json()) as {
      resource_response?: {
        data?: {
          title?: string;
          grid_title?: string;
          pinner?: { full_name?: string; username?: string };
          closeup_attribution?: { full_name?: string };
          videos?: { video_list?: Record<string, { url: string }> };
          story_pin_data?: {
            pages?: Array<{
              blocks?: Array<{
                video?: { video_list?: Record<string, { url: string }> };
              }>;
            }>;
          };
          images?: Record<string, { url: string; width: number }>;
        };
      };
    };

    const data = json.resource_response?.data;
    if (!data) {
      throw new ParseError("Invalid Pinterest API response", "pinterest");
    }

    const title = data.title || data.grid_title || "Pinterest Pin";
    const author =
      data.closeup_attribution?.full_name ||
      data.pinner?.full_name ||
      data.pinner?.username ||
      "Unknown";

    const story_pages = data.story_pin_data?.pages;
    if (story_pages) {
      for (const page of story_pages) {
        const blocks = page.blocks;
        if (!blocks) continue;

        for (const block of blocks) {
          const video_list = block.video?.video_list;
          if (!video_list) continue;

          for (const quality of VIDEO_QUALITY_PRIORITY) {
            const video = video_list[quality];
            if (video?.url && !video.url.endsWith(".m3u8")) {
              return {
                urls: [
                  {
                    type: "video",
                    url: video.url,
                    filename: `pinterest-${pin_id}.mp4`,
                  },
                ],
                headers: {},
                meta: { title, author, platform: "pinterest" },
              };
            }
          }
        }
      }
    }

    const video_list = data.videos?.video_list;
    if (video_list) {
      for (const quality of VIDEO_QUALITY_PRIORITY) {
        const video = video_list[quality];
        if (video?.url && !video.url.endsWith(".m3u8")) {
          return {
            urls: [
              {
                type: "video",
                url: video.url,
                filename: `pinterest-${pin_id}.mp4`,
              },
            ],
            headers: {},
            meta: { title, author, platform: "pinterest" },
          };
        }
      }
    }

    const images = data.images;
    if (!images) {
      throw new ParseError("No media found in pin", "pinterest");
    }

    let image_url = images["orig"]?.url;
    if (!image_url) {
      let max_width = 0;
      for (const img of Object.values(images)) {
        if (img.width > max_width && img.url) {
          max_width = img.width;
          image_url = img.url;
        }
      }
    }

    if (!image_url) {
      throw new ParseError("No image URL found", "pinterest");
    }

    const ext = image_url.split(".").pop()?.split("?")[0] || "jpg";

    return {
      urls: [
        {
          type: "image",
          url: image_url,
          filename: `pinterest-${pin_id}.${ext}`,
        },
      ],
      headers: {},
      meta: { title, author, platform: "pinterest" },
    };
  } catch (e: any) {
    if (e instanceof NetworkError || e instanceof ParseError) throw e;
    throw new ParseError(e.message, "pinterest");
  }
}
