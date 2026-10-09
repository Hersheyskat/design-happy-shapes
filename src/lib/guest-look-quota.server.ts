import { createHash } from "node:crypto";

const FREE_LOOKS = 2;

export function clientIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "unknown").trim() || "unknown";
  return createHash("sha256").update(`${process.env["LOVABLE_CRON_SECRET"] ?? "shoplook"}:guest-ip:${ip}`).digest("hex");
}

export async function claimGuestLook(ipHash: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const claimed = await supabaseAdmin.rpc("claim_guest_look_generation", { _ip_hash: ipHash, _max_count: FREE_LOOKS });
  if (claimed.error) throw claimed.error;
  return typeof claimed.data === "number" ? claimed.data : -1;
}

export async function releaseGuestLook(ipHash: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("release_guest_look_generation", { _ip_hash: ipHash });
}
