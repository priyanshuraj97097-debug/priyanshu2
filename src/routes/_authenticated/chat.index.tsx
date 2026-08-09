import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: () => <ChatPanel conversationId={null} />,
});