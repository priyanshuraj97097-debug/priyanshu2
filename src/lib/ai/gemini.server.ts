/**
 * Gemini provider layer (server-only).
 *
 * The model is configured here in ONE place. Change GEMINI_MODEL (or set the
 * GEMINI_MODEL env var) to switch models without touching any UI code.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export function getGeminiModel(): string {
  return process.env["GEMINI_MODEL"] || DEFAULT_GEMINI_MODEL;
}

export const GEMINI_GENERATION_CONFIG = {
  temperature: 0.8,
  topP: 0.95,
  maxOutputTokens: 8192,
};

export type GeminiTurn = { role: "user" | "assistant"; content: string };

export type GeminiStreamResult =
  | { ok: true; body: ReadableStream<Uint8Array>; model: string }
  | { ok: false; status: number; message: string };

export const BUSY_MESSAGE = "Priyanshu 2.0 is temporarily busy. Please try again in a moment.";

/**
 * Calls the Google Gemini API with SSE streaming. The API key never leaves the server.
 */
export async function streamGemini(opts: {
  system: string;
  turns: GeminiTurn[];
  signal?: AbortSignal;
}): Promise<GeminiStreamResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    return { ok: false, status: 500, message: BUSY_MESSAGE };
  }

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:streamGenerateContent?alt=sse`;

  const contents = opts.turns
    .filter((t) => t.content?.trim())
    .map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    }));

  if (contents.length === 0) {
    return { ok: false, status: 400, message: BUSY_MESSAGE };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents,
        generationConfig: GEMINI_GENERATION_CONFIG,
      }),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch (error) {
    console.error("Gemini network error", error);
    return { ok: false, status: 503, message: BUSY_MESSAGE };
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    console.error("Gemini API error", response.status, detail.slice(0, 500));
    if (response.status === 429) {
      return {
        ok: false,
        status: 429,
        message:
          "Priyanshu 2.0 has reached its current usage limit. Please try again in a little while.",
      };
    }
    return { ok: false, status: response.status >= 500 ? 502 : 400, message: BUSY_MESSAGE };
  }

  return { ok: true, body: response.body, model };
}

/** Extracts text deltas from one Gemini SSE `data:` payload. */
export function parseGeminiDelta(payload: string): string {
  try {
    const json = JSON.parse(payload) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  } catch {
    return "";
  }
}
