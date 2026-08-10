import { useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

import { Sidebar } from "@/components/chat/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Workspace · Priyanshu 2.0" },
      { name: "description", content: "Your private Priyanshu 2.0 workspace: conversations, files and models." },
      { property: "og:title", content: "Workspace · Priyanshu 2.0" },
      { property: "og:description", content: "Your private Priyanshu 2.0 workspace." },
    ],
  }),
  component: ChatLayout,
});

function ChatLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border md:block">
        <Sidebar />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <BrandLogo className="size-7" />
            <span className="text-sm font-semibold">Priyanshu 2.0</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}