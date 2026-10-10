import { createFileRoute } from "@tanstack/react-router";
import { ShopLookShell } from "@/components/shoplook-shell";
import { StylistChat } from "@/components/stylist-chat";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Your stylist chat — ShopLook" },
      {
        name: "description",
        content:
          "Continue your private ShopLook stylist conversation and ask about outfits, colours and styling.",
      },
      { property: "og:title", content: "Your stylist chat — ShopLook" },
      {
        property: "og:description",
        content: "Your ongoing private conversation with the ShopLook stylist.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <ShopLookShell>
      <StylistChat page open onOpenChange={() => {}} productName="" comment="" imageUrl="" />
    </ShopLookShell>
  );
}
