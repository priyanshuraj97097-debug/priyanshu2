import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Check,
  Copy,
  ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/chat/Markdown";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { ModeSelector } from "@/components/chat/ModeSelector";
import { AttachmentImage } from "@/components/chat/AttachmentImage";
import {
  createConversation,
  insertUserMessage,
  listMessages,
  renameConversation,
  setConversationModel,
  uploadFile,
  SUPPORTED_FILE_ACCEPT,
  type Attachment,
} from "@/lib/data/chat";
import { DEFAULT_MODEL_SLUG } from "@/lib/ai/models";
import { DEFAULT_MODE, type ModeKey } from "@/lib/ai/modes";
import { useSpeechInput } from "@/hooks/useSpeechInput";

const SUGGESTIONS = [
  { label: "Explain something", prompt: "Explain quantum computing in simple terms" },
  { label: "Help me write", prompt: "Help me write a professional email about " },
  { label: "Help me code", prompt: "Write a TypeScript function that " },
  { label: "Analyze a file", prompt: "Summarise the key points of the file I attach" },
  { label: "Brainstorm ideas", prompt: "Brainstorm 10 creative ideas for " },
  { label: "Solve a problem", prompt: "Solve step by step: " },
];

const GENERIC_ERROR = "Something went wrong while generating the response. Please try again.";

type StreamEvent =
  | { t: "delta"; v: string }
  | { t: "done" }
  | { t: "error"; code?: string; message?: string };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy response"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

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
  const [mode, setMode] = useState<ModeKey>(DEFAULT_MODE);
  const [tool, setTool] = useState<"chat" | "image">("chat");
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (conversationModel) setModel(conversationModel);
  }, [conversationModel]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => listMessages(conversationId!),
    enabled: !!conversationId,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamed]);

  const speech = useSpeechInput(
    useCallback((text: string) => {
      setInput((prev) => (prev ? `${prev.trim()} ${text}` : text));
    }, []),
  );

  /** One streaming attempt. Returns how it ended so the caller can retry safely. */
  const attemptStream = useCallback(
    async (
      id: string,
      currentMode: ModeKey,
      signal: AbortSignal,
    ): Promise<{ status: "ok" | "aborted" | "failed"; received: boolean; message?: string }> => {
      let received = false;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return { status: "failed", received, message: "Please sign in again." };

      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversationId: id, mode: currentMode }),
          signal,
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") return { status: "aborted", received };
        return { status: "failed", received, message: "Connection interrupted. Please try again." };
      }

      if (!res.ok || !res.body) {
        return { status: "failed", received, message: GENERIC_ERROR };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failure: string | undefined;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            if (!raw.trim()) continue;
            let evt: StreamEvent;
            try {
              evt = JSON.parse(raw) as StreamEvent;
            } catch {
              continue;
            }
            if (evt.t === "delta") {
              received = true;
              if (mountedRef.current) setStreamed((prev) => prev + evt.v);
            } else if (evt.t === "error") {
              failure = evt.message || GENERIC_ERROR;
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return { status: "aborted", received };
        failure = "Connection interrupted. Please try again.";
      } finally {
        try {
          await reader.cancel();
        } catch {
          /* stream already closed */
        }
      }

      if (failure) return { status: "failed", received, message: failure };
      return { status: "ok", received };
    },
    [],
  );

  const runStream = useCallback(
    async (id: string, currentMode: ModeKey) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setIsStreaming(true);
      setStreamed("");
      setErrorMessage(null);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let result = await attemptStream(id, currentMode, controller.signal);
        // One safe retry only when nothing was delivered yet.
        if (result.status === "failed" && !result.received && !controller.signal.aborted) {
          setStreamed("");
          result = await attemptStream(id, currentMode, controller.signal);
        }
        if (result.status === "failed" && mountedRef.current) {
          setErrorMessage(result.message ?? GENERIC_ERROR);
        }
      } finally {
        abortRef.current = null;
        busyRef.current = false;
        if (mountedRef.current) {
          setIsStreaming(false);
          setStreamed("");
        }
        await queryClient.invalidateQueries({ queryKey: ["messages", id] });
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
    [attemptStream, queryClient],
  );

  useEffect(() => {
    if (autorun && conversationId && !startedRef.current) {
      startedRef.current = true;
      void runStream(conversationId, mode);
      void navigate({
        to: "/chat/$conversationId",
        params: { conversationId },
        search: {},
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorun, conversationId]);

  const generateImageFor = useCallback(
    async (id: string, prompt: string) => {
      setGeneratingImage(true);
      setErrorMessage(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversationId: id, prompt }),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || !json?.ok) {
          setErrorMessage(json?.error ?? "Something went wrong while generating the image. Please try again.");
        }
      } catch {
        setErrorMessage("Connection interrupted. Please try again.");
      } finally {
        if (mountedRef.current) setGeneratingImage(false);
        await queryClient.invalidateQueries({ queryKey: ["messages", id] });
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
    [queryClient],
  );

  const send = useMutation({
    mutationFn: async () => {
      if (busyRef.current || generatingImage) return;
      const text = input.trim();
      if (!text && attachments.length === 0) return;
      if (tool === "image" && !text) {
        toast("Describe the image you want to generate.");
        return;
      }
      setInput("");
      const files = attachments;
      setAttachments([]);

      if (!conversationId) {
        const conversation = await createConversation(model, text.slice(0, 60) || "New chat");
        await insertUserMessage(conversation.id, text, files);
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        if (tool === "image") {
          await navigate({
            to: "/chat/$conversationId",
            params: { conversationId: conversation.id },
            search: {},
          });
          await generateImageFor(conversation.id, text);
          return;
        }
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
      if (tool === "image") await generateImageFor(conversationId, text);
      else await runStream(conversationId, mode);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(list).slice(0, 4)) {
        const attachment = await uploadFile(file, conversationId);
        if (mountedRef.current) setAttachments((prev) => [...prev, attachment]);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      if (mountedRef.current) setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleModelChange(slug: string) {
    setModel(slug);
    if (conversationId) await setConversationModel(conversationId, slug);
  }

  function retry() {
    if (!conversationId) return;
    setErrorMessage(null);
    void runStream(conversationId, mode);
  }

  const empty = !conversationId || (!isLoading && messages.length === 0);
  const busy = isStreaming || generatingImage;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="scrollbar-slim flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          {empty ? (
            <div className="flex flex-col items-center justify-center pt-10 text-center sm:pt-20">
              <BrandLogo className="size-20 sm:size-24" />
              <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">Ask Priyanshu 2.0 anything</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Chat, generate an image, attach a file for analysis, or switch modes to change how
                Priyanshu 2.0 thinks.
              </p>
              <div className="mt-8 grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setInput(s.prompt)}
                    className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-left text-sm font-medium transition-colors hover:border-primary/50 hover:bg-card"
                  >
                    {s.label}
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
                          {m.attachments.map((a) =>
                            a.mime_type?.startsWith("image/") ? (
                              <AttachmentImage key={a.id} attachment={a} />
                            ) : (
                              <span
                                key={a.id}
                                className="rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground"
                              >
                                {a.name}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    <BrandLogo className="mt-1 size-7" />
                    <div className="min-w-0 flex-1">
                      <Markdown content={m.content} />
                      {m.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {m.attachments.map((a) =>
                            a.mime_type?.startsWith("image/") ? (
                              <AttachmentImage key={a.id} attachment={a} />
                            ) : null,
                          )}
                        </div>
                      )}
                      <div className="mt-1.5">
                        <CopyButton text={m.content} />
                      </div>
                    </div>
                  </div>
                ),
              )}
              {isStreaming && (
                <div className="flex gap-3">
                  <BrandLogo className="mt-1 size-7" />
                  <div className="min-w-0 flex-1">
                    {streamed ? (
                      <Markdown content={streamed} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-sm">
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        <span className="aurora-text font-medium">Priyanshu 2.0 is responding…</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              {generatingImage && (
                <div className="flex gap-3">
                  <BrandLogo className="mt-1 size-7" />
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    <span className="aurora-text font-medium">Creating your image…</span>
                  </span>
                </div>
              )}
              {errorMessage && !busy && (
                <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card/60 px-4 py-3">
                  <p className="text-sm text-muted-foreground">{errorMessage}</p>
                  <Button size="sm" variant="secondary" onClick={retry}>
                    Try again
                  </Button>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                >
                  {a.name}
                  <button
                    aria-label={`Remove ${a.name}`}
                    onClick={() => setAttachments((p) => p.filter((x) => x.id !== a.id))}
                  >
                    <X className="size-3 text-muted-foreground" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="aurora-frame rounded-2xl border border-border bg-card p-2 shadow-lg transition-colors focus-within:border-primary/60">
            <span aria-hidden className={`aurora-frame-glow ${busy ? "aurora-active" : ""}`} />
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy && !send.isPending) send.mutate();
                }
              }}
              placeholder={
                tool === "image"
                  ? "Describe an image to generate…"
                  : "Ask Priyanshu 2.0 anything…"
              }
              rows={1}
              className="max-h-48 min-h-11 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
            />
            <div className="flex flex-wrap items-center gap-1 px-1 pt-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={SUPPORTED_FILE_ACCEPT}
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
                className={`size-8 ${speech.listening ? "text-primary" : "text-muted-foreground"}`}
                onClick={() =>
                  speech.listening ? speech.stop() : speech.start((m) => toast.error(m))
                }
                aria-label={speech.listening ? "Stop voice input" : "Voice input"}
              >
                {speech.listening ? <Square className="size-3.5" /> : <Mic className="size-4" />}
              </Button>
              <div className="flex items-center rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setTool("chat")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                    tool === "chat" ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <MessageSquare className="size-3.5" /> Chat
                </button>
                <button
                  type="button"
                  onClick={() => setTool("image")}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                    tool === "image" ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ImageIcon className="size-3.5" /> Image
                </button>
              </div>
              {tool === "chat" && <ModeSelector value={mode} onChange={setMode} />}
              <div className="hidden sm:block">
                <ModelSelector value={model} onChange={handleModelChange} />
              </div>
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
                  disabled={
                    send.isPending || busy || (!input.trim() && attachments.length === 0)
                  }
                  onClick={() => send.mutate()}
                  aria-label="Send message"
                >
                  {send.isPending || busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          {speech.listening && (
            <p className="mt-2 text-center text-[11px] text-primary">Listening… tap the square to stop.</p>
          )}
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Priyanshu 2.0 can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
