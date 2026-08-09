import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Layers, Lock, MessagesSquare, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Priyanshu AI — Your modular AI assistant" },
      {
        name: "description",
        content:
          "Priyanshu AI is a fast, private AI assistant: multi-model chat, file analysis, saved conversations and a workspace built for real work.",
      },
      { property: "og:title", content: "Priyanshu AI — Your modular AI assistant" },
      {
        property: "og:description",
        content: "Multi-model AI chat with file analysis, searchable history and a premium workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Layers, title: "Multiple models", body: "Switch between fast and deep-reasoning models per conversation." },
  { icon: FileText, title: "File analysis", body: "Upload documents and ask questions about their contents." },
  { icon: MessagesSquare, title: "Organised history", body: "Rename, pin, search and revisit every conversation." },
  { icon: Zap, title: "Streaming replies", body: "Answers arrive token by token, no waiting on a spinner." },
  { icon: Lock, title: "Private by default", body: "Every conversation is scoped to your account only." },
  { icon: Sparkles, title: "Built to extend", body: "Tools, web search, voice and images plug into the same core." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="brand-gradient-bg flex size-8 items-center justify-center rounded-lg">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold">Priyanshu AI</span>
        </div>
        <Link to="/auth">
          <Button variant="secondary" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <main>
        <section className="surface-glow px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            The assistant workspace
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            Think faster with <span className="brand-gradient-text">Priyanshu AI</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            A general-purpose AI assistant with multi-model chat, file understanding and a workspace
            that keeps every conversation exactly where you left it.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="rounded-xl px-7">
                Start chatting free
              </Button>
            </Link>
            <Link to="/chat">
              <Button size="lg" variant="secondary" className="rounded-xl px-7">
                Open workspace
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <f.icon className="size-5 text-primary" />
                <h2 className="mt-4 text-base font-semibold">{f.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Priyanshu AI
      </footer>
    </div>
  );
}
