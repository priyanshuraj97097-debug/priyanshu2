import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { DEFAULT_MODEL_SLUG } from "@/lib/ai/models";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Priyanshu 2.0" },
      { name: "description", content: "Manage your Priyanshu 2.0 profile, default model, custom instructions and usage." },
      { property: "og:title", content: "Settings · Priyanshu 2.0" },
      { property: "og:description", content: "Manage your profile, default model and custom instructions." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL_SLUG);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profile, prefs, usage] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle(),
        supabase
          .from("user_model_preferences")
          .select("default_model_slug, custom_instructions")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase.from("usage_events").select("total_tokens").eq("user_id", user!.id),
      ]);
      return {
        displayName: profile.data?.display_name ?? "",
        prefs: prefs.data,
        requests: usage.data?.length ?? 0,
        tokens: (usage.data ?? []).reduce((sum, r) => sum + (r.total_tokens ?? 0), 0),
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.displayName);
    setInstructions(data.prefs?.custom_instructions ?? "");
    setModel(data.prefs?.default_model_slug ?? DEFAULT_MODEL_SLUG);
  }, [data]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
      await supabase.from("user_model_preferences").upsert(
        {
          user_id: user.id,
          default_model_slug: model,
          custom_instructions: instructions,
        },
        { onConflict: "user_id" },
      );
      await queryClient.invalidateQueries({ queryKey: ["settings", user.id] });
      toast.success("Settings saved");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scrollbar-slim min-h-screen overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <Link to="/chat" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to chat
        </Link>
        <h1 className="mt-6 text-2xl font-semibold">Settings</h1>

        <section className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h2>
          <div className="space-y-1.5">
            <Label htmlFor="display">Display name</Label>
            <Input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
        </section>

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assistant</h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Default model</p>
              <p className="text-xs text-muted-foreground">Used for every new conversation.</p>
            </div>
            <ModelSelector value={model} onChange={setModel} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instructions">Custom instructions</Label>
            <Textarea
              id="instructions"
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Tell the assistant how you like to be helped…"
            />
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Requests</p>
            <p className="mt-1 text-2xl font-semibold">{data?.requests ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tokens used</p>
            <p className="mt-1 text-2xl font-semibold">{data?.tokens ?? 0}</p>
          </div>
        </section>

        <Button className="mt-6" onClick={save} disabled={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}