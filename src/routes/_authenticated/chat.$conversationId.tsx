import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { getConversation } from "@/lib/data/chat";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  validateSearch: (search: Record<string, unknown>) => ({
    autorun: search["autorun"] === true || search["autorun"] === "true" ? true : undefined,
  }),
  component: ConversationRoute,
});

function ConversationRoute() {
  const { conversationId } = useParams({ from: "/_authenticated/chat/$conversationId" });
  const { autorun } = useSearch({ from: "/_authenticated/chat/$conversationId" });
  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId),
  });

  return (
    <ChatPanel
      key={conversationId}
      conversationId={conversationId}
      conversationModel={conversation?.model_slug}
      autorun={!!autorun}
    />
  );
}