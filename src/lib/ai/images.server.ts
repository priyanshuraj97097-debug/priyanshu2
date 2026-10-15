/**
 * Image generation provider layer (server-only).
 */
import { env } from "cloudflare:workers";

export const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export type ImageResult =
  | { ok: true; base64: string }
  | { ok: false; code: "rate_limit" | "network" | "timeout" | "server" | "rejected"; message: string };

export async function generateImage(prompt: string): Promise<ImageResult> {
  try {
    const result = await env.AI.run(IMAGE_MODEL, { prompt, steps: 4 });
    if (!result.image) {
      console.error("Workers AI returned no generated image");
      return {
        ok: false,
        code: "server",
        message: "Something went wrong while generating the image. Please try again.",
      };
    }
    return { ok: true, base64: result.image };
  } catch (error) {
    console.error("image provider network error", error);
    return { ok: false, code: "network", message: "Connection interrupted. Please try again." };
  }
}
