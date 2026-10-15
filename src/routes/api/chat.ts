import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  messageForCode,
  parseGeminiDelta,
  streamGemini,
  type GeminiPart,
  type GeminiTurn,
  type StreamErrorCode,
} from "@/lib/ai/gemini.server";
import { DEFAULT_MODE, isModeKey, type ModeKey } from "@/lib/ai/modes";

/**
 * AI model layer — the only place that talks to the AI provider.
 * Provider keys never leave the server.
 *
 * Wire format: newline-delimited JSON events
 *   {"t":"delta","v":"..."} | {"t":"done"} | {"t":"error","code":"...","message":"..."}
 */

type ChatRequestBody = { conversationId?: string; mode?: string };

/** Formats the provider can consume inline. */
const INLINE_MIME = /^(image\/(png|jpeg|jpg|webp|gif|heic|heif)|application\/pdf)$/i;
const MAX_INLINE_BYTES = 6 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function userScopedClient(accessToken: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Database service configuration is missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${accessToken}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!accessToken) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
        const conversationId = body.conversationId;
        const mode: ModeKey = isModeKey(body.mode) ? body.mode : DEFAULT_MODE;
        if (!conversationId) return new Response("conversationId is required", { status: 400 });

        const supabase = userScopedClient(accessToken);
        const { data: userData } = await supabase.auth.getUser(accessToken);
        const user = userData.user;
        if (!user) return new Response("Unauthorized", { status: 401 });
        const userId = user.id;

        const { data: conversation } = await supabase
          .from("conversations")
          .select("id, model_slug, system_prompt, user_id")
          .eq("id", conversationId)
          .maybeSingle();
        if (!conversation || conversation.user_id !== userId) {
          return new Response("Conversation not found", { status: 404 });
        }

        const [{ data: history }, { data: memory }, { data: prefs }] = await Promise.all([
          supabase
            .from("messages")
            .select("role, content, attachments")
            .eq("conversation_id", conversationId)
            .order("created_at")
            .limit(80),
          supabase.from("user_memory").select("content").eq("is_active", true).limit(30),
          supabase
            .from("user_model_preferences")
            .select("custom_instructions, temperature")
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        // File layer: text is inlined as context; images/PDFs are sent to the model as data parts.
        const fileIds = (history ?? []).flatMap((m) =>
          Array.isArray(m.attachments)
            ? (m.attachments as { id?: string }[])
                .map((a) => a?.id)
                .filter((id): id is string => typeof id === "string")
            : [],
        );
        let fileContext = "";
        const mediaParts: GeminiPart[] = [];
        if (fileIds.length) {
          const { data: files } = await supabase
            .from("uploaded_files")
            .select("file_name, mime_type, extracted_text, storage_path, size_bytes")
            .in("id", fileIds.slice(-8));
          const notes: string[] = [];
          for (const f of files ?? []) {
            const mime = f.mime_type ?? "";
            if (INLINE_MIME.test(mime) && (f.size_bytes ?? 0) <= MAX_INLINE_BYTES) {
              const { data: blob, error } = await supabase.storage
                .from("chat-files")
                .download(f.storage_path);
              if (error || !blob) {
                console.error("attachment download failed", error?.message);
                notes.push(`--- FILE: ${f.file_name} — could not be read ---`);
                continue;
              }
              const bytes = new Uint8Array(await blob.arrayBuffer());
              mediaParts.push({ inlineData: { mimeType: mime, data: toBase64(bytes) } });
              notes.push(
                `--- ATTACHED ${mime.startsWith("image/") ? "IMAGE" : "PDF"}: ${f.file_name} (provided to you directly) ---`,
              );
            } else if (f.extracted_text) {
              notes.push(
                `--- FILE: ${f.file_name} (${mime || "unknown"}) ---\n${f.extracted_text.slice(0, 24000)}`,
              );
            } else {
              notes.push(
                `--- FILE: ${f.file_name} (${mime || "unknown"}) — this format could not be read; tell the user the format is unsupported ---`,
              );
            }
          }
          fileContext = notes.join("\n\n");
        }

        const systemParts = [
          "You are Priyanshu 2.0, a precise, friendly and capable general-purpose AI assistant. Use markdown for structure and code blocks. Be direct and helpful. Never mention the underlying model or provider — you are Priyanshu 2.0.",
          conversation.system_prompt,
          prefs?.custom_instructions ? `User custom instructions:\n${prefs.custom_instructions}` : null,
          memory?.length
            ? `Long-term memory about the user:\n${memory.map((m) => `- ${m.content}`).join("\n")}`
            : null,
          fileContext ? `Files the user attached in this conversation:\n${fileContext}` : null,
        ].filter(Boolean) as string[];

        const turns: GeminiTurn[] = (history ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
          .map((m) => ({
            role: m.role as "user" | "assistant",
            parts: [{ text: m.content }] as GeminiPart[],
          }));
        if (mediaParts.length) {
          const last = turns[turns.length - 1];
          if (last && last.role === "user") last.parts.push(...mediaParts);
          else turns.push({ role: "user", parts: mediaParts });
        }

        const encoder = new TextEncoder();
        const event = (obj: unknown) => encoder.encode(`${JSON.stringify(obj)}\n`);

        const result = await streamGemini({ system: systemParts.join("\n\n"), turns, mode });

        if (!result.ok) {
          return new Response(event({ t: "error", code: result.code, message: result.message }), {
            status: 200,
            headers: {
              "Content-Type": "application/x-ndjson; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
            },
          });
        }

        const model = result.model;
        const upstreamBody = result.body;
        const decoder = new TextDecoder();
        let full = "";
        let persisted = false;

        async function persist() {
          if (persisted) return;
          persisted = true;
          if (!full.trim()) return;
          try {
            await supabase.from("messages").insert({
              conversation_id: conversationId!,
              user_id: userId,
              role: "assistant",
              content: full,
              model_slug: model,
              metadata: { mode } as never,
            });
            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", conversationId!);
            await supabase.from("usage_events").insert({
              user_id: userId,
              conversation_id: conversationId!,
              event_type: "chat_completion",
              model_slug: model,
              total_tokens: Math.ceil(full.length / 4),
            });
          } catch (error) {
            console.error("persist assistant message failed", error);
          }
        }

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstreamBody.getReader();
            let buffer = "";
            let clientGone = false;
            const push = (chunk: Uint8Array) => {
              if (clientGone) return;
              try {
                controller.enqueue(chunk);
              } catch {
                // Client disconnected — keep draining upstream so the answer is still saved.
                clientGone = true;
              }
            };
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const raw of lines) {
                  const trimmed = raw.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") continue;
                  const delta = parseGeminiDelta(payload);
                  if (delta) {
                    full += delta;
                    push(event({ t: "delta", v: delta }));
                  }
                }
              }
              if (full.trim()) push(event({ t: "done" }));
              else
                push(
                  event({
                    t: "error",
                    code: "server" satisfies StreamErrorCode,
                    message: messageForCode("server"),
                  }),
                );
            } catch (error) {
              console.error("stream error", error);
              const code: StreamErrorCode = full ? "network" : "server";
              push(event({ t: "error", code, message: messageForCode(code) }));
            } finally {
              try {
                reader.releaseLock();
              } catch {
                /* already released */
              }
              await persist();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          },
          async cancel() {
            try {
              await upstreamBody.cancel();
            } catch {
              /* ignore */
            }
            await persist();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
