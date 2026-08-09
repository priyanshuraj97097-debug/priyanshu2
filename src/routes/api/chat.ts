import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * AI model layer — the only place that talks to the AI provider.
 * Provider keys never leave the server.
 */
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ChatRequestBody = { conversationId?: string };

function userScopedClient(accessToken: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
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

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });

        const { conversationId } = (await request.json()) as ChatRequestBody;
        if (!conversationId) return new Response("conversationId is required", { status: 400 });

        const supabase = userScopedClient(accessToken);
        const { data: userData } = await supabase.auth.getUser(accessToken);
        const user = userData.user;
        if (!user) return new Response("Unauthorized", { status: 401 });

        const { data: conversation } = await supabase
          .from("conversations")
          .select("id, model_slug, system_prompt, user_id")
          .eq("id", conversationId)
          .maybeSingle();
        if (!conversation || conversation.user_id !== user.id) {
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
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        // File layer: inline extracted text for any attached files.
        const fileIds = (history ?? []).flatMap((m) =>
          Array.isArray(m.attachments)
            ? (m.attachments as { id?: string }[]).map((a) => a?.id).filter(Boolean as unknown as (v: unknown) => v is string)
            : [],
        );
        let fileContext = "";
        if (fileIds.length) {
          const { data: files } = await supabase
            .from("uploaded_files")
            .select("file_name, mime_type, extracted_text")
            .in("id", fileIds.slice(-8));
          fileContext = (files ?? [])
            .map(
              (f) =>
                `--- FILE: ${f.file_name} (${f.mime_type ?? "unknown"}) ---\n${(f.extracted_text ?? "[binary file, no text extracted]").slice(0, 24000)}`,
            )
            .join("\n\n");
        }

        const systemParts = [
          "You are Priyanshu AI, a precise, friendly and capable general-purpose AI assistant. Use markdown for structure and code blocks. Be direct and helpful.",
          conversation.system_prompt,
          prefs?.custom_instructions ? `User custom instructions:\n${prefs.custom_instructions}` : null,
          memory?.length ? `Long-term memory about the user:\n${memory.map((m) => `- ${m.content}`).join("\n")}` : null,
          fileContext ? `Files the user attached in this conversation:\n${fileContext}` : null,
        ].filter(Boolean);

        const messages = [
          { role: "system", content: systemParts.join("\n\n") },
          ...(history ?? [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        ];

        const model = conversation.model_slug || "google/gemini-3.6-flash";
        const body: Record<string, unknown> = { model, messages, stream: true };
        if (model.startsWith("openai/gpt-5.6")) body["reasoning_effort"] = "none";

        const upstream = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
          console.error("AI gateway error", upstream.status, detail);
          return new Response(
            status === 429
              ? "Rate limit reached. Please try again in a moment."
              : status === 402
                ? "AI credits exhausted. Add credits to keep chatting."
                : "The assistant could not respond right now.",
            { status },
          );
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let full = "";

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            let buffer = "";
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith("data:")) continue;
                  const payload = trimmed.slice(5).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload) as {
                      choices?: { delta?: { content?: string } }[];
                    };
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                      full += delta;
                      controller.enqueue(encoder.encode(delta));
                    }
                  } catch {
                    /* ignore keep-alive fragments */
                  }
                }
              }
            } catch (error) {
              console.error("stream error", error);
            } finally {
              controller.close();
              if (full.trim()) {
                // Message layer + usage layer persistence
                await supabase.from("messages").insert({
                  conversation_id: conversationId,
                  user_id: user.id,
                  role: "assistant",
                  content: full,
                  model_slug: model,
                });
                await supabase
                  .from("conversations")
                  .update({ last_message_at: new Date().toISOString() })
                  .eq("id", conversationId);
                await supabase.from("usage_events").insert({
                  user_id: user.id,
                  conversation_id: conversationId,
                  event_type: "chat_completion",
                  model_slug: model,
                  total_tokens: Math.ceil(full.length / 4),
                });
              }
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
      },
    },
  },
});