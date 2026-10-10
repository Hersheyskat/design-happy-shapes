import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UIMessage } from "ai";

export const loadStylistChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("stylist_conversations").select("messages").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("Your stylist conversation could not load. Please try again.");
    return { messages: (data?.messages ?? []) as unknown as UIMessage[] };
  });