import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const eventTypes = ["look_created", "look_saved", "buy_click", "share_click"] as const;

const eventInput = z.object({
  eventType: z.enum(eventTypes),
  catalogProductId: z.string().uuid().nullable().optional(),
  savedLookId: z.string().uuid().nullable().optional(),
  lookImagePath: z.string().trim().min(1).max(500).nullable().optional(),
  inputImagePath: z.string().trim().min(1).max(500).nullable().optional(),
  channel: z.string().trim().min(1).max(40).nullable().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export const recordShopperEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => eventInput.parse(input))
  .handler(async ({ data, context }) => {
    const lookImagePath = data.lookImagePath ?? null;
    const inputImagePath = data.inputImagePath ?? null;
    if (lookImagePath && !lookImagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid look image path.");
    }
    if (inputImagePath && !inputImagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid input image path.");
    }
    if (data.eventType === "look_created" && !lookImagePath) {
      throw new Error("A look image is required.");
    }
    const result = await context.supabase.from("shopper_events").insert({
      event_type: data.eventType,
      actor_type: "auth",
      user_id: context.userId,
      catalog_product_id: data.catalogProductId ?? null,
      saved_look_id: data.savedLookId ?? null,
      look_image_path: lookImagePath,
      input_image_path: inputImagePath,
      channel: data.channel ?? null,
      metadata: data.metadata as Json,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true as const };
  });
