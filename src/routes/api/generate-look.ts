import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

import { claimGuestLook, clientIpHash, releaseGuestLook } from "@/lib/guest-look-quota.server";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function signedInUserId(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || token.split(".").length !== 3) return null;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
        if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
        if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

export const Route = createFileRoute("/api/generate-look")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Request not allowed." }, { status: 403 });
        const key = process.env["OPENROUTER_API_KEY"];
        if (!key) return Response.json({ message: "AI looks are not connected yet. The illustrative preview is still available." }, { status: 503 });
        const size = Number(request.headers.get("content-length") ?? 0);
        if (size > 13_000_000) return Response.json({ message: "Images are too large. Choose smaller photos." }, { status: 413 });
        const form = await request.formData().catch(() => null);
        const person = form?.get("person");
        const garment = form?.get("garment");
        const note = form?.get("note");
        if (!(person instanceof File) || !(garment instanceof File) || !imageTypes.has(person.type) || !imageTypes.has(garment.type) || person.size > 8_000_000 || garment.size > 4_000_000 || typeof note !== "string" || note.length > 280) {
          return Response.json({ message: "Choose valid JPG, PNG or WebP images and try again." }, { status: 400 });
        }

        const userId = await signedInUserId(request);
        const ipHash = userId ? null : clientIpHash(request);
        if (ipHash) {
          try {
            const remaining = await claimGuestLook(ipHash);
            if (remaining < 0) return Response.json({ message: "Sign in to create more looks.", code: "login_required" }, { status: 401 });
          } catch {
            return Response.json({ message: "AI looks are temporarily unavailable. Please try again shortly." }, { status: 503 });
          }
        }

        const hash = createHash("sha256").update(`${process.env["LOVABLE_CRON_SECRET"] ?? "shoplook"}:${userId ? `user:${userId}` : `guest:${ipHash}`}`).digest("hex");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cooldown = await supabaseAdmin.rpc("claim_ai_generation_cooldown", { _client_hash: hash });
        if (cooldown.error) {
          if (ipHash) await releaseGuestLook(ipHash);
          return Response.json({ message: "AI looks are temporarily unavailable. Please try again shortly." }, { status: 503 });
        }
        if (!cooldown.data) {
          if (ipHash) await releaseGuestLook(ipHash);
          return Response.json({ message: "Please wait a moment before making another AI look." }, { status: 429 });
        }

        const encode = async (file: File) => Buffer.from(await file.arrayBuffer()).toString("base64");
        try {
          const [personData, garmentData] = await Promise.all([encode(person), encode(garment)]);
          const upstream = await fetch("https://openrouter.ai/api/v1/images", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image",
              prompt: `Create ONE photorealistic full-body image of the SAME PERSON from reference image 1 WEARING the featured garment from reference image 2. Reference 1 is the shopper: preserve their face, identity, skin tone, body shape and natural proportions; keep their pose and background where possible. Reference 2 shows the catalog item, possibly worn by a different model: use it ONLY to identify the garment, its color, cut and texture. Dress the shopper in that item realistically, adapting the garment to their body and existing pose, regardless of whether the catalog model has a different gender or appearance. Never copy the catalog model's face or body. The output must be a SINGLE unified image of the shopper in the item, NOT a collage, side-by-side comparison, split-screen, product photo, or before-and-after layout. Do not add text or logos. Shopper style direction: ${note.trim() || "natural everyday styling"}. This is a visual styling suggestion, not a fitting or sizing prediction.`,
              input_references: [
                { type: "image_url", image_url: { url: `data:${person.type};base64,${personData}` } },
                { type: "image_url", image_url: { url: `data:${garment.type};base64,${garmentData}` } },
              ],
            }),
          });
          const result = await upstream.json().catch(() => null) as { data?: { b64_json?: string; media_type?: string }[]; error?: { message?: string } } | null;
          if (!upstream.ok) {
            if (ipHash) await releaseGuestLook(ipHash);
            const fallback = upstream.status === 429 ? "OpenRouter is busy. Please try again later." : "OpenRouter could not make this look right now.";
            return Response.json({ message: result?.error?.message ?? fallback }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
          }
          const image = result?.data?.[0];
          const mime = image?.media_type ?? "image/png";
          if (!image?.b64_json || !["image/png", "image/jpeg", "image/webp"].includes(mime)) {
            if (ipHash) await releaseGuestLook(ipHash);
            return Response.json({ message: "OpenRouter did not return a finished image. Your preview is still available." }, { status: 502 });
          }
          return Response.json({ image: `data:${mime};base64,${image.b64_json}` }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          if (ipHash) await releaseGuestLook(ipHash);
          return Response.json({ message: "Could not reach OpenRouter right now. Your preview is still available." }, { status: 502 });
        }
      },
    },
  },
});
