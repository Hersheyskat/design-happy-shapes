import { createFileRoute } from "@tanstack/react-router";
import { handleStylistChat } from "@/lib/stylist-chat.server";

export const Route = createFileRoute("/api/stylist-chat")({
  server: { handlers: { POST: ({ request }) => handleStylistChat(request) } },
});