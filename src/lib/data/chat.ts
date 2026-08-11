import { supabase } from "@/integrations/supabase/client";
import type { AiModel } from "@/lib/ai/models";
import { DEFAULT_MODEL_SLUG, FALLBACK_MODELS } from "@/lib/ai/models";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  model_slug: string | null;
  attachments: Attachment[];
  created_at: string;
};

export type Attachment = {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

export type Conversation = {
  id: string;
  title: string;
  model_slug: string;
  is_pinned: boolean;
  last_message_at: string;
  created_at: string;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function listModels(): Promise<AiModel[]> {
  const { data, error } = await supabase
    .from("ai_models")
    .select("slug, provider, display_name, description, capabilities, context_window, tier, is_default, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error || !data?.length) return FALLBACK_MODELS;
  return data.map((m) => ({
    ...m,
    capabilities: Array.isArray(m.capabilities) ? (m.capabilities as string[]) : [],
  })) as AiModel[];
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, model_slug, is_pinned, last_message_at, created_at")
    .eq("is_archived", false)
    .order("is_pinned", { ascending: false })
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, model_slug, is_pinned, last_message_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Conversation) ?? null;
}

export async function createConversation(modelSlug = DEFAULT_MODEL_SLUG, title = "New chat") {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id, model_slug: modelSlug, title })
    .select("id, title, model_slug, is_pinned, last_message_at, created_at")
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function renameConversation(id: string, title: string) {
  const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function setConversationModel(id: string, model_slug: string) {
  const { error } = await supabase.from("conversations").update({ model_slug }).eq("id", id);
  if (error) throw error;
}

export async function togglePinned(id: string, is_pinned: boolean) {
  const { error } = await supabase.from("conversations").update({ is_pinned }).eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, model_slug, attachments, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    ...m,
    attachments: Array.isArray(m.attachments) ? (m.attachments as unknown as Attachment[]) : [],
  })) as ChatMessage[];
}

export async function insertUserMessage(
  conversationId: string,
  content: string,
  attachments: Attachment[] = [],
) {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      user_id,
      role: "user",
      content,
      attachments: attachments as unknown as never,
    })
    .select("id")
    .single();
  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
  return data.id as string;
}

export async function searchConversations(term: string) {
  const clean = term.trim();
  if (!clean) return [] as { id: string; title: string; snippet: string }[];
  const [byTitle, byMessage] = await Promise.all([
    supabase.from("conversations").select("id, title").ilike("title", `%${clean}%`).limit(10),
    supabase
      .from("messages")
      .select("conversation_id, content, conversations(title)")
      .ilike("content", `%${clean}%`)
      .limit(15),
  ]);
  const results = new Map<string, { id: string; title: string; snippet: string }>();
  for (const c of byTitle.data ?? []) results.set(c.id, { id: c.id, title: c.title, snippet: "" });
  for (const m of byMessage.data ?? []) {
    const title = (m as { conversations?: { title?: string } }).conversations?.title ?? "Conversation";
    if (!results.has(m.conversation_id)) {
      results.set(m.conversation_id, {
        id: m.conversation_id,
        title,
        snippet: m.content.slice(0, 140),
      });
    }
  }
  return [...results.values()];
}

export async function uploadFile(file: File, conversationId: string | null) {
  const user_id = await requireUserId();
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than 20 MB.`);
  }
  if (!isSupportedFile(file)) {
    throw new Error(`${file.name} isn't a supported file type.`);
  }
  const path = `${user_id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("chat-files").upload(path, file);
  if (upErr) throw new Error("Upload failed. Please try again.");

  let extracted: string | null = null;
  if (/^text\/|json|csv|markdown|javascript|xml/.test(file.type) || /\.(md|txt|csv|json|ts|tsx|js|py)$/i.test(file.name)) {
    extracted = (await file.text()).slice(0, 200_000);
  }

  const { data, error } = await supabase
    .from("uploaded_files")
    .insert({
      user_id,
      conversation_id: conversationId,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: path,
      extracted_text: extracted,
      status: extracted ? "ready" : "stored",
    })
    .select("id, file_name, mime_type, size_bytes")
    .single();
  if (error) throw error;

  if (extracted) {
    const chunkSize = 4000;
    const chunks: { file_id: string; user_id: string; chunk_index: number; content: string }[] = [];
    for (let i = 0; i * chunkSize < extracted.length && i < 50; i++) {
      chunks.push({
        file_id: data.id,
        user_id,
        chunk_index: i,
        content: extracted.slice(i * chunkSize, (i + 1) * chunkSize),
      });
    }
    if (chunks.length) await supabase.from("file_chunks").insert(chunks);
  }

  return {
    id: data.id,
    name: data.file_name,
    mime_type: data.mime_type,
    size_bytes: data.size_bytes,
  } as Attachment;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Formats we can actually do something useful with. */
export const SUPPORTED_FILE_ACCEPT =
  "image/*,application/pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.xml,.docx";

const TEXT_EXT = /\.(md|markdown|txt|csv|json|ts|tsx|js|jsx|py|html|css|xml|yml|yaml|sql|docx)$/i;

export function isSupportedFile(file: File) {
  const type = file.type || "";
  return (
    type.startsWith("image/") ||
    type === "application/pdf" ||
    /^text\/|json|csv|markdown|javascript|xml/.test(type) ||
    TEXT_EXT.test(file.name)
  );
}

/** Short-lived signed URL for a private file the current user owns. */
export async function getFileUrl(fileId: string): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("uploaded_files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error || !row) return null;
  const { data } = await supabase.storage
    .from("chat-files")
    .createSignedUrl(row.storage_path, 60 * 60);
  return data?.signedUrl ?? null;
}