/**
 * Image generation provider layer (server-only).
 * Swap IMAGE_MODEL to change providers without touching UI code.
 */
export const IMAGE_MODEL = process.env["IMAGE_MODEL"] || "openai/gpt-image-2";

export type ImageResult =
  | { ok: true; base64: string }
  | { ok: false; code: "rate_limit" | "network" | "timeout" | "server" | "rejected"; message: string };

export async function generateImage(prompt: string): Promise<ImageResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    console.error("LOVABLE_API_KEY missing for image generation");
    return { ok: false, code: "server", message: "Image generation is not available right now." };
  }

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });
  } catch (error) {
    console.error("image provider network error", error);
    return { ok: false, code: "network", message: "Connection interrupted. Please try again." };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("image provider error", response.status, detail.slice(0, 500));
    if (response.status === 429 || response.status === 402) {
      return {
        ok: false,
        code: "rate_limit",
        message: "Priyanshu 2.0 is temporarily busy. Please try again in a moment.",
      };
    }
    if (/content_policy|moderation/i.test(detail)) {
      return {
        ok: false,
        code: "rejected",
        message: "That image request was declined. Try describing it differently.",
      };
    }
    return {
      ok: false,
      code: "server",
      message: "Something went wrong while generating the image. Please try again.",
    };
  }

  const json = (await response.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null;
  const base64 = json?.data?.[0]?.b64_json;
  if (!base64) {
    console.error("image provider returned no image");
    return {
      ok: false,
      code: "server",
      message: "Something went wrong while generating the image. Please try again.",
    };
  }
  return { ok: true, base64 };
}
