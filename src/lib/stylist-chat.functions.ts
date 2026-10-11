import { createServerFn } from "@tanstack/react-start";
import { validateUIMessages, type UIMessage } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type {
  StylistActiveLook,
  StylistLookTrayItem,
  StylistMessageMetadata,
} from "@/lib/stylist-chat.types";

const HISTORY_LIMIT = 80;
const TRAY_LIMIT = 12;

type MessageRow = Database["public"]["Tables"]["stylist_messages"]["Row"];
type SavedLookRow = Pick<
  Database["public"]["Tables"]["saved_looks"]["Row"],
  "id" | "product_name" | "headline" | "summary" | "style_note" | "shopper_image_path"
>;

function rowToMessage(row: MessageRow, savedPath?: string | null): UIMessage {
  const imagePath = row.session_image_path || savedPath || undefined;
  const metadata: StylistMessageMetadata = {
    ...(row.product_name ? { productName: row.product_name } : {}),
    ...(row.comment ? { comment: row.comment } : {}),
    ...(imagePath ? { imagePath } : {}),
    ...(row.saved_look_id ? { savedLookId: row.saved_look_id } : {}),
  };
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    parts: (Array.isArray(row.parts) ? row.parts : []) as UIMessage["parts"],
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

async function signPaths(
  supabase: { storage: { from: (bucket: string) => { createSignedUrls: (paths: string[], expiresIn: number) => Promise<{ data: Array<{ path: string | null; signedUrl: string | null } | null> | null }> } } },
  paths: string[],
) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.storage.from("shoplook-media").createSignedUrls(unique, 3600);
  return new Map(
    (data ?? []).flatMap((entry) =>
      entry?.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [],
    ),
  );
}

export const loadStylistChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error: initError } = await context.supabase
      .from("stylist_conversations")
      .upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (initError) throw new Error("Your stylist conversation could not open. Please try again.");

    const [{ data: conversation, error: conversationError }, { data: rows, error: messagesError }, { data: savedLooks, error: looksError }] =
      await Promise.all([
        context.supabase
          .from("stylist_conversations")
          .select(
            "active_saved_look_id, active_session_image_path, active_product_name, active_comment",
          )
          .eq("user_id", context.userId)
          .single(),
        context.supabase
          .from("stylist_messages")
          .select("*")
          .eq("user_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(HISTORY_LIMIT),
        context.supabase
          .from("saved_looks")
          .select("id, product_name, headline, summary, style_note, shopper_image_path")
          .eq("user_id", context.userId)
          .eq("is_removed", false)
          .order("created_at", { ascending: false })
          .limit(TRAY_LIMIT),
      ]);

    if (conversationError || messagesError || looksError) {
      throw new Error("Your stylist conversation could not load. Please try again.");
    }

    const chronological = [...(rows ?? [])].reverse();
    const savedById = new Map((savedLooks as SavedLookRow[] | null)?.map((look) => [look.id, look]) ?? []);
    const pathNeeded = chronological.flatMap((row) => {
      if (row.session_image_path) return [row.session_image_path];
      if (row.saved_look_id) {
        const look = savedById.get(row.saved_look_id);
        return look ? [look.shopper_image_path] : [];
      }
      return [];
    });
    for (const look of savedLooks ?? []) pathNeeded.push(look.shopper_image_path);
    if (conversation?.active_session_image_path) pathNeeded.push(conversation.active_session_image_path);
    if (conversation?.active_saved_look_id) {
      const activeSaved = savedById.get(conversation.active_saved_look_id);
      if (activeSaved) pathNeeded.push(activeSaved.shopper_image_path);
      else {
        const { data: missing } = await context.supabase
          .from("saved_looks")
          .select("id, product_name, headline, summary, style_note, shopper_image_path")
          .eq("id", conversation.active_saved_look_id)
          .eq("user_id", context.userId)
          .maybeSingle();
        if (missing) {
          savedById.set(missing.id, missing);
          pathNeeded.push(missing.shopper_image_path);
        }
      }
    }

    const urls = await signPaths(context.supabase, pathNeeded);
    const rawMessages = chronological.map((row) => {
      const saved = row.saved_look_id ? savedById.get(row.saved_look_id) : undefined;
      return rowToMessage(row, saved?.shopper_image_path);
    });
    const messages = rawMessages.length
      ? await validateUIMessages({ messages: rawMessages })
      : [];

    const lookTray: StylistLookTrayItem[] = (savedLooks ?? []).flatMap((look) => {
      const imageUrl = urls.get(look.shopper_image_path);
      if (!imageUrl) return [];
      return [
        {
          kind: "saved" as const,
          savedLookId: look.id,
          productName: look.product_name || look.headline || "Saved ShopLook",
          comment: (look.summary || look.style_note || "").slice(0, 500),
          imageUrl,
          imagePath: look.shopper_image_path,
        },
      ];
    });

    let activeLook: StylistActiveLook | { kind: null } = { kind: null };

    if (conversation?.active_saved_look_id) {
      const look = savedById.get(conversation.active_saved_look_id);
      const imagePath = look?.shopper_image_path ?? "";
      const imageUrl = imagePath ? urls.get(imagePath) ?? "" : "";
      if (look && imageUrl) {
        activeLook = {
          kind: "saved",
          savedLookId: look.id,
          productName: look.product_name || look.headline || "Saved ShopLook",
          comment: (look.summary || look.style_note || "").slice(0, 500),
          imageUrl,
          imagePath,
        };
      }
    } else if (conversation?.active_session_image_path) {
      const imagePath = conversation.active_session_image_path;
      const imageUrl = urls.get(imagePath) ?? "";
      if (imageUrl) {
        activeLook = {
          kind: "session",
          sessionImagePath: imagePath,
          productName: conversation.active_product_name ?? "Your ShopLook",
          comment: conversation.active_comment ?? "",
          imageUrl,
          imagePath,
        };
      }
    }

    return {
      messages: JSON.stringify(messages),
      activeLook: JSON.stringify(activeLook),
      lookTray: JSON.stringify(lookTray),
    };
  });
