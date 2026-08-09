import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PlusIcon,
  Search,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteConversation,
  listConversations,
  renameConversation,
  searchConversations,
  togglePinned,
} from "@/lib/data/chat";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const params = useParams({ strict: false }) as { conversationId?: string };
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["search", term],
    queryFn: () => searchConversations(term),
    enabled: searchOpen && term.trim().length > 1,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["conversations"] });

  const remove = useMutation({
    mutationFn: deleteConversation,
    onSuccess: async (_d, id) => {
      await refresh();
      if (params.conversationId === id) navigate({ to: "/chat" });
      toast.success("Conversation deleted");
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameConversation(id, title),
    onSuccess: async () => {
      await refresh();
      setRenaming(null);
    },
  });

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="brand-gradient-bg flex size-8 items-center justify-center rounded-lg">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <span className="font-display text-sm font-semibold tracking-tight">Priyanshu AI</span>
      </div>

      <div className="space-y-1 px-3">
        <Link to="/chat" onClick={onNavigate}>
          <Button className="w-full justify-start gap-2 rounded-xl" variant="secondary">
            <PlusIcon className="size-4" /> New chat
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 rounded-xl text-muted-foreground"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4" /> Search chats
        </Button>
      </div>

      <div className="scrollbar-slim mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <p className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          History
        </p>
        {conversations.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded-lg px-2 transition-colors hover:bg-sidebar-accent ${
              params.conversationId === c.id ? "bg-sidebar-accent" : ""
            }`}
          >
            <Link
              to="/chat/$conversationId"
              params={{ conversationId: c.id }}
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2 py-2 text-sm"
            >
              {c.is_pinned ? (
                <Pin className="size-3.5 shrink-0 text-primary" />
              ) : (
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{c.title}</span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label="Conversation options"
                >
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming({ id: c.id, title: c.title })}>
                  <Pencil className="size-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await togglePinned(c.id, !c.is_pinned);
                    refresh();
                  }}
                >
                  <Pin className="size-3.5" /> {c.is_pinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(c.id)}>
                  <Trash2 className="size-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <Link to="/settings" onClick={onNavigate}>
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            <Settings className="size-4" /> Settings
          </Button>
        </Link>
        <div className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">
            {user?.email?.[0] ?? "U"}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user?.email}</span>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
            aria-label="Sign out"
          >
            <LogOut className="size-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search conversations</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search titles and messages…"
          />
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <Link
                key={r.id}
                to="/chat/$conversationId"
                params={{ conversationId: r.id }}
                onClick={() => {
                  setSearchOpen(false);
                  onNavigate?.();
                }}
                className="block rounded-lg px-3 py-2 hover:bg-secondary"
              >
                <p className="text-sm font-medium">{r.title}</p>
                {r.snippet && <p className="truncate text-xs text-muted-foreground">{r.snippet}</p>}
              </Link>
            ))}
            {term.trim().length > 1 && results.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matches found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renaming?.title ?? ""}
            onChange={(e) => setRenaming((p) => (p ? { ...p, title: e.target.value } : p))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renaming) rename.mutate(renaming);
            }}
          />
          <Button onClick={() => renaming && rename.mutate(renaming)}>Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}