import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Loader2, Mic, Paperclip, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/chat/Markdown";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { ToolMenu } from "@/components/chat/ToolMenu";
import {
  createConversation,
  insertUserMessage,
  listMessages,
  renameConversation,
  setConversationModel,
  uploadFile,
  type Attachment,
} from "@/lib/data/chat";
import { DEFAULT_MODEL_SLUG } from "@/lib/ai/models";

const SUGGESTIONS = [
  "Explain a complex topic in simple terms",
  "Draft a professional email for me",
  "Review this code and suggest improvements",
  "Summarise the file I upload",
];

export function ChatPanel({
  conversationId,
  conversationModel,
  autorun = false,
}: {
  conversationId: string | null;
  conversationModel?: string | undefined;
  autorun?: boolean | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [streamed, setStreamed] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState(conversationModel ?? DEFAULT_MODEL_SLUG);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (conversationModel) setModel(conversationModel);
  }, [conversationModel]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => listMessages(conversationId!),
    enabled: !!conversationId,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamed]);

  async function runStream(id: string) {
    setIsStreaming(true);
    setStreamed("");
    setFailed(false);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: id }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const message = await res
          .text()
          .catch(() => "Priyanshu 2.0 is temporarily busy. Please try again in a moment.");
        setFailed(true);
        toast.error(message || "Priyanshu 2.0 is temporarily busy. Please try again in a moment.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setStreamed((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setFailed(true);
        toast.error("Priyanshu 2.0 is temporarily busy. Please try again in a moment.");
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      setStreamed("");
      await queryClient.invalidateQueries({ queryKey: ["messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  }

  useEffect(() => {
    if (autorun && conversationId && !startedRef.current) {
      startedRef.current = true;
      void runStream(conversationId);
      void navigate({ to: "/chat/$conversationId", params: { conversationId }, search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorun, conversationId]);

  const send = useMutation({
    mutationFn: async () => {
      const text = input.trim();
      if (!text && attachments.length === 0) return;
      setInput("");
      const files = attachments;
      setAttachments([]);

      if (!conversationId) {
        const conversation = await createConversation(model, text.slice(0, 60) || "New chat");
        await insertUserMessage(conversation.id, text, files);
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        await navigate({
          to: "/chat/$conversationId",
          params: { conversationId: conversation.id },
          search: { autorun: true },
        });
        return;
      }

      await insertUserMessage(conversationId, text, files);
      if (messages.length === 0 && text) await renameConversation(conversationId, text.slice(0, 60));
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      await runStream(conversationId);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(list).slice(0, 4)) {
        const attachment = await uploadFile(file, conversationId);
        setAttachments((prev) => [...prev, attachment]);
      }
      toast.success("File ready for analysis");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleModelChange(slug: string) {
    setModel(slug);
    if (conversationId) await setConversationModel(conversationId, slug);
  }

  const empty = !conversationId || (!isLoading && messages.length === 0);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="scrollbar-slim flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          {empty ? (
            <div className="flex flex-col items-center justify-center pt-10 text-center sm:pt-20">
              <div className="brand-gradient-bg flex size-12 items-center justify-center rounded-2xl">
                <Sparkles className="size-6 text-primary-foreground" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">How can I help today?</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask anything, attach a file for analysis, or pick a different model to change how
                Priyanshu 2.0 thinks.
              </p>
              <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-3 text-sm">
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.attachments.map((a) => (
                            <span
                              key={a.id}
                              className="rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground"
                            >
                              {a.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    <div className="brand-gradient-bg mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg">
                      <Sparkles className="size-3.5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Markdown content={m.content} />
                    </div>
                  </div>
                ),
              )}
              {isStreaming && (
                <div className="flex gap-3">
                  <div className="brand-gradient-bg mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg">
                    <Sparkles className="size-3.5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {streamed ? (
                      <Markdown content={streamed} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Thinking…
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                >
                  {a.name}
                  <button onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}>
                    <X className="size-3 text-muted-foreground" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card p-2 shadow-lg transition-colors focus-within:border-primary/60">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) send.mutate();
                }
              }}
              placeholder="Message Priyanshu 2.0…"
              rows={1}
              className="max-h-48 min-h-11 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center gap-1 px-1 pt-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                aria-label="Attach file"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={() => toast("Voice input is coming soon")}
                aria-label="Voice input"
              >
                <Mic className="size-4" />
              </Button>
              <ModelSelector value={model} onChange={handleModelChange} />
              <ToolMenu />
              <div className="flex-1" />
              {isStreaming ? (
                <Button
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Stop"
                >
                  <Square className="size-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="size-8 rounded-full"
                  disabled={send.isPending || (!input.trim() && attachments.length === 0)}
                  onClick={() => send.mutate()}
                  aria-label="Send message"
                >
                  {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Priyanshu 2.0 can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}