/**
 * Image generation provider layer (server-only).
 */
import { env } from "cloudflare:workers";

export const IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const FALLBACK_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export type ImageResult =
  | { ok: true; base64: string }
  | { ok: false; code: "rate_limit" | "network" | "timeout" | "server" | "rejected"; message: string };

function isRateLimit(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /\b429\b|rate.?limit|too many requests/i.test(error.message);
}

async function generateWithPrimaryModel(prompt: string) {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", "1024");
  form.append("height", "1024");
  const serialized = new Response(form);
  const contentType = serialized.headers.get("content-type");
  if (!serialized.body || !contentType) throw new Error("Unable to prepare image request");

  const result = await env.AI.run(IMAGE_MODEL, {
    multipart: { body: serialized.body, contentType },
  });
  return result.image;
}

export async function generateImage(prompt: string): Promise<ImageResult> {
  let primaryError: unknown;
  try {
    const image = await generateWithPrimaryModel(prompt);
    if (image) return { ok: true, base64: image };
    primaryError = new Error("Primary image model returned no image");
  } catch (error) {
    primaryError = error;
  }

  console.warn("Primary image model unavailable; trying the fallback model.");
  try {
    const fallback = await env.AI.run(FALLBACK_IMAGE_MODEL, { prompt, steps: 4 });
    if (fallback.image) return { ok: true, base64: fallback.image };
  } catch (fallbackError) {
    const rateLimited = isRateLimit(primaryError) || isRateLimit(fallbackError);
    return {
      ok: false,
      code: rateLimited ? "rate_limit" : "server",
      message: rateLimited
        ? "Image generation is temporarily busy. Please try again."
        : "Image generation could not complete. Please try again.",
    };
  }

  return {
    ok: false,
    code: isRateLimit(primaryError) ? "rate_limit" : "server",
    message: isRateLimit(primaryError)
      ? "Image generation is temporarily busy. Please try again."
      : "Image generation could not complete. Please try again.",
  };
}
