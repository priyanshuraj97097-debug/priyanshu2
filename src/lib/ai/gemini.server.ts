import { DEFAULT_MODE, type ModeKey } from "@/lib/ai/modes";

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
  // Keep latency low for conversational replies.
  thinkingConfig: { thinkingLevel: "low" },
};

/** Per-mode server-side behaviour. Modes are real: they change instructions and sampling. */
type ModeConfig = {
  instructions: string;
  generationConfig: Record<string, unknown>;
};

const MODE_CONFIGS: Record<ModeKey, ModeConfig> = {
  all_rounder: {
    instructions:
      "Mode: All-Rounder. Act as a balanced general-purpose assistant covering questions, explanations, writing, reasoning, coding, planning, summaries and everyday tasks. Match the depth of the answer to the difficulty of the request.",
    generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } },
  },
  deep_thinking: {
    instructions:
      "Mode: Deep Thinking. The question is likely hard. Reason carefully before answering: identify assumptions, consider alternatives and trade-offs, then give a well-structured conclusion. Only present reasoning you actually performed. State uncertainty explicitly instead of guessing confidently.",
    generationConfig: { temperature: 0.6, topP: 0.95, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "high" } },
  },
  math: {
    instructions:
      "Mode: Math & Complex Problems. Specialise in mathematics (algebra, geometry, calculus, probability, statistics), logic and multi-step reasoning. Restate the problem, define notation, solve step by step showing each transformation, then give the final result clearly. Sanity-check the result and say what you verified. Never claim guaranteed correctness; note where an error could hide.",
    generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "high" } },
  },
  coding: {
    instructions:
      "Mode: Coding. Specialise in programming, debugging, code explanation, architecture, refactoring and error diagnosis. Always use fenced code blocks with a language tag. Prefer complete, runnable snippets, point out edge cases, and explain the diagnosis before the fix.",
    generationConfig: { temperature: 0.3, topP: 0.9, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } },
  },
  writing: {
    instructions:
      "Mode: Writing. Focus on clear, well-structured prose: drafting, rewriting, tone adjustment, summarising and editing. Respect the requested tone, audience and length. Return polished text rather than notes about the text.",
    generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } },
  },
  creative: {
    instructions:
      "Mode: Creative. Favour original, imaginative output: ideas, concepts, stories, names, campaigns. Offer varied options rather than one safe answer, and keep them concrete.",
    generationConfig: { temperature: 1.0, topP: 0.98, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } },
  },
  fast: {
    instructions:
      "Mode: Fast Answer. Answer as directly and briefly as possible — ideally a few sentences or a short list. No preamble, no restating the question, no filler. Add detail only if the user asks.",
    generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: "low" } },
  },
};

export function getModeConfig(mode: ModeKey = DEFAULT_MODE): ModeConfig {
  return MODE_CONFIGS[mode] ?? MODE_CONFIGS[DEFAULT_MODE];
}

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiTurn = { role: "user" | "assistant"; parts: GeminiPart[] };

export type StreamErrorCode = "rate_limit" | "network" | "timeout" | "server";

export type GeminiStreamResult =
  | { ok: true; body: ReadableStream<Uint8Array>; model: string }
  | { ok: false; status: number; code: StreamErrorCode; message: string };

export const BUSY_MESSAGE = "Priyanshu 2.0 is temporarily busy. Please try again in a moment.";
export const NETWORK_MESSAGE = "Connection interrupted. Please try again.";
export const TIMEOUT_MESSAGE = "The response took too long. Please try again.";
export const SERVER_MESSAGE = "Something went wrong while generating the response. Please try again.";

export function messageForCode(code: StreamErrorCode): string {
  if (code === "rate_limit") return BUSY_MESSAGE;
  if (code === "network") return NETWORK_MESSAGE;
  if (code === "timeout") return TIMEOUT_MESSAGE;
  return SERVER_MESSAGE;
}

/** Time we allow the provider to return response headers. Generation itself is unbounded. */
const CONNECT_TIMEOUT_MS = 60_000;

/**
 * Calls the Google Gemini API with SSE streaming. The API key never leaves the server.
 *
 * Resilience notes:
 * - The caller's request signal is intentionally NOT forwarded: a client that
 *   disconnects mid-stream must not abort the provider call while we are still
 *   persisting the partial answer ("BodyStreamBuffer was aborted").
 * - A fresh AbortController per attempt guards only the connect phase, so a
 *   long-idle deployment with a cold/stale connection fails fast and retries
 *   instead of hanging.
 * - One automatic retry happens before any content has been produced.
 */
async function streamGeminiOnce(opts: {
  system: string;
  turns: GeminiTurn[];
  mode?: ModeKey;
}): Promise<GeminiStreamResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not configured");
    return { ok: false, status: 500, code: "server", message: SERVER_MESSAGE };
  }

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:streamGenerateContent?alt=sse`;

  const contents = opts.turns
    .filter((t) => t.parts.length > 0)
    .map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: t.parts,
    }));

  if (contents.length === 0) {
    return { ok: false, status: 400, code: "server", message: SERVER_MESSAGE };
  }

  const modeConfig = getModeConfig(opts.mode ?? DEFAULT_MODE);
  const connectAbort = new AbortController();
  const connectTimer = setTimeout(() => connectAbort.abort(), CONNECT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${opts.system}\n\n${modeConfig.instructions}` }] },
        contents,
        generationConfig: modeConfig.generationConfig,
      }),
      signal: connectAbort.signal,
    });
  } catch (error) {
    clearTimeout(connectTimer);
    const aborted = (error as Error)?.name === "AbortError";
    console.error("Gemini connect error", aborted ? "timeout" : error);
    return aborted
      ? { ok: false, status: 504, code: "timeout", message: TIMEOUT_MESSAGE }
      : { ok: false, status: 503, code: "network", message: NETWORK_MESSAGE };
  } finally {
    clearTimeout(connectTimer);
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    console.error("Gemini API error", response.status, detail.slice(0, 500));
    if (response.status === 429 || response.status === 402) {
      return { ok: false, status: 429, code: "rate_limit", message: BUSY_MESSAGE };
    }
    return response.status >= 500
      ? { ok: false, status: 502, code: "network", message: NETWORK_MESSAGE }
      : { ok: false, status: 400, code: "server", message: SERVER_MESSAGE };
  }

  return { ok: true, body: response.body, model };
}

/** Connect with one automatic retry for transient failures (no content produced yet). */
export async function streamGemini(opts: {
  system: string;
  turns: GeminiTurn[];
  mode?: ModeKey;
}): Promise<GeminiStreamResult> {
  const first = await streamGeminiOnce(opts);
  if (first.ok) return first;
  if (first.code === "network" || first.code === "timeout") {
    await new Promise((r) => setTimeout(r, 400));
    console.warn("Retrying Gemini request once after", first.code);
    return streamGeminiOnce(opts);
  }
  return first;
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
