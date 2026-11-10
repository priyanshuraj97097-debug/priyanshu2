import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateImage, IMAGE_MODEL } from "@/lib/ai/images.server";

type Body = { conversationId?: string; prompt?: string };

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

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!accessToken) return new Response("Unauthorized", { status: 401 });

        const { conversationId, prompt } = (await request.json().catch(() => ({}))) as Body;
        if (
          !conversationId ||
          typeof prompt !== "string" ||
          !prompt.trim() ||
          prompt.trim().length > 2048
        ) {
          return new Response(
            JSON.stringify({
              error: typeof prompt === "string" && prompt.trim()
                ? "Keep image prompts under 2,048 characters."
                : "A prompt is required.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const supabase = userScopedClient(accessToken);
        const { data: userData } = await supabase.auth.getUser(accessToken);
        const user = userData.user;
        if (!user) return new Response("Unauthorized", { status: 401 });

        const { data: conversation } = await supabase
          .from("conversations")
          .select("id, user_id")
          .eq("id", conversationId)
          .maybeSingle();
        if (!conversation || conversation.user_id !== user.id) {
          return new Response("Conversation not found", { status: 404 });
        }

        const result = await generateImage(prompt.trim());
        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.message, code: result.code }), {
            status: result.code === "rate_limit" ? 429 : 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const bytes = decodeBase64(result.base64);
        const extension = result.mimeType === "image/png" ? "png" : "jpg";
        const path = `${user.id}/generated/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("chat-files")
          .upload(path, bytes, { contentType: result.mimeType });
        if (uploadError) {
          console.error("generated image upload failed", uploadError.message);
          return new Response(
            JSON.stringify({ error: "Something went wrong while saving the image. Please try again." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        const fileName = `${prompt.trim().slice(0, 40).replace(/[^\w\s.-]/g, "") || "image"}.${extension}`;
        const { data: fileRow, error: fileError } = await supabase
          .from("uploaded_files")
          .insert({
            user_id: user.id,
            conversation_id: conversationId,
            file_name: fileName,
            mime_type: result.mimeType,
            size_bytes: bytes.byteLength,
            storage_path: path,
            status: "ready",
            metadata: { generated: true, prompt: prompt.trim(), model: result.model } as never,
          })
          .select("id, file_name, mime_type, size_bytes")
          .single();
        if (fileError || !fileRow) {
          console.error("generated image row failed", fileError?.message);
          await supabase.storage.from("chat-files").remove([path]).catch(() => undefined);
          return new Response(
            JSON.stringify({ error: "Something went wrong while saving the image. Please try again." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        const { error: messageError } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: `Here is the image for: **${prompt.trim()}**`,
          model_slug: result.model,
          attachments: [
            {
              id: fileRow.id,
              name: fileRow.file_name,
              mime_type: fileRow.mime_type,
              size_bytes: fileRow.size_bytes,
            },
          ] as never,
          metadata: { kind: "image" } as never,
        });
        if (messageError) {
          console.error("generated image message failed", messageError.message);
          await Promise.allSettled([
            supabase.from("uploaded_files").delete().eq("id", fileRow.id),
            supabase.storage.from("chat-files").remove([path]),
          ]);
          return new Response(
            JSON.stringify({ error: "The image was created, but could not be added to this conversation. Please try again." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
        await supabase.from("usage_events").insert({
          user_id: user.id,
          conversation_id: conversationId,
          event_type: "image_generation",
          model_slug: result.model,
          total_tokens: 0,
        });

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
