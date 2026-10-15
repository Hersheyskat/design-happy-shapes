import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startMySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase.rpc("start_my_session");
    if (result.error) throw new Error(result.error.message);
    if (typeof result.data !== "string" || !result.data) {
      throw new Error("Could not start login session.");
    }
    return { sessionId: result.data };
  });

export const endMySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase.rpc("end_my_session");
    if (result.error) throw new Error(result.error.message);
    return { ok: true as const };
  });
