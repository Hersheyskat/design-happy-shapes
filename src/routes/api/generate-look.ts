import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

import { claimGuestLook, clientIpHash, releaseGuestLook } from "@/lib/guest-look-quota.server";
import { openRouterApiKey, openRouterClientError, openRouterPost } from "@/lib/openrouter.server";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(value: FormDataEntryValue | null | undefined, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readUuid(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

async function signedInUserId(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || token.split(".").length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as {
      sub?: unknown;
      exp?: unknown;
      iss?: unknown;
      role?: unknown;
    };
    if (typeof payload.sub !== "string" || !payload.sub || payload.role === "anon") return null;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now() - 30_000) return null;
    const supabaseUrl = process.env["SUPABASE_URL"];
    if (
      supabaseUrl &&
      typeof payload.iss === "string" &&
      payload.iss &&
      !payload.iss.includes(new URL(supabaseUrl).hostname)
    )
      return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/generate-look")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin)
          return Response.json({ message: "Request not allowed." }, { status: 403 });
        const key = openRouterApiKey();
        if (!key)
          return Response.json(
            {
              message:
                "AI looks are not connected yet. The illustrative preview is still available.",
            },
            { status: 503 },
          );
        const size = Number(request.headers.get("content-length") ?? 0);
        if (size > 13_000_000)
          return Response.json(
            { message: "Images are too large. Choose smaller photos." },
            { status: 413 },
          );
        const form = await request.formData().catch(() => null);
        const person = form?.get("person");
        const garment = form?.get("garment");
        const note = form?.get("note");
        if (
          !(person instanceof File) ||
          !(garment instanceof File) ||
          !imageTypes.has(person.type) ||
          !imageTypes.has(garment.type) ||
          person.size > 8_000_000 ||
          garment.size > 4_000_000 ||
          typeof note !== "string" ||
          note.length > 280
        ) {
          return Response.json(
            { message: "Choose valid JPG, PNG or WebP images and try again." },
            { status: 400 },
          );
        }

        const userId = await signedInUserId(request);
        const ipHash = userId ? null : clientIpHash(request);
        const hasAdmin = Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
        let claimedGuest = false;
        if (ipHash && hasAdmin) {
          try {
            const remaining = await claimGuestLook(ipHash);
            if (remaining < 0)
              return Response.json(
                { message: "Sign in to create more looks.", code: "login_required" },
                { status: 401 },
              );
            claimedGuest = true;
          } catch {
            return Response.json(
              { message: "AI looks are temporarily unavailable. Please try again shortly." },
              { status: 503 },
            );
          }
        }

        const { supabaseAdmin } = hasAdmin
          ? await import("@/integrations/supabase/client.server")
          : { supabaseAdmin: null };
        if (hasAdmin && supabaseAdmin) {
          const hash = createHash("sha256")
            .update(
              `${process.env["LOVABLE_CRON_SECRET"] ?? "shoplook"}:${userId ? `user:${userId}` : `guest:${ipHash}`}`,
            )
            .digest("hex");
          try {
            const cooldown = await supabaseAdmin.rpc("claim_ai_generation_cooldown", {
              _client_hash: hash,
            });
            if (cooldown.error) {
              if (claimedGuest && ipHash) await releaseGuestLook(ipHash);
              return Response.json(
                { message: "AI looks are temporarily unavailable. Please try again shortly." },
                { status: 503 },
              );
            }
            if (!cooldown.data) {
              if (claimedGuest && ipHash) await releaseGuestLook(ipHash);
              return Response.json(
                { message: "Please wait a moment before making another AI look." },
                { status: 429 },
              );
            }
          } catch {
            if (claimedGuest && ipHash) await releaseGuestLook(ipHash);
            return Response.json(
              { message: "AI looks are temporarily unavailable. Please try again shortly." },
              { status: 503 },
            );
          }
        }

        const catalogProductId = readUuid(form?.get("catalogProductId"));
        const productName = readText(form?.get("productName"), 240);
        const retailer = readText(form?.get("retailer"), 100);
        const audience = readText(form?.get("audience"), 20);
        const price = Number(readText(form?.get("price"), 20));

        const encode = async (file: File) =>
          Buffer.from(await file.arrayBuffer()).toString("base64");
        try {
          const [personData, garmentData] = await Promise.all([encode(person), encode(garment)]);
          const { status, json } = await openRouterPost("/api/v1/images", key, {
            model: "google/gemini-3.1-flash-image",
            prompt: `Create ONE photorealistic full-body image of the SAME PERSON from reference image 1 WEARING the featured garment from reference image 2. Reference 1 is the shopper: preserve their face, identity, skin tone, body shape and natural proportions; keep their pose and background where possible. Reference 2 shows the catalog item, possibly worn by a different model: use it ONLY to identify the garment, its color, cut and texture. Dress the shopper in that item realistically, adapting the garment to their body and existing pose, regardless of whether the catalog model has a different gender or appearance. Never copy the catalog model's face or body. The output must be a SINGLE unified image of the shopper in the item, NOT a collage, side-by-side comparison, split-screen, product photo, or before-and-after layout. Do not add text or logos. Shopper style direction: ${note.trim() || "natural everyday styling"}. This is a visual styling suggestion, not a fitting or sizing prediction.`,
            input_references: [
              { type: "image_url", image_url: { url: `data:${person.type};base64,${personData}` } },
              {
                type: "image_url",
                image_url: { url: `data:${garment.type};base64,${garmentData}` },
              },
            ],
          });
          const result = json as {
            data?: { b64_json?: string; media_type?: string }[];
            error?: { message?: string };
          } | null;
          if (status < 200 || status >= 300) {
            if (claimedGuest && ipHash) await releaseGuestLook(ipHash);
            const error = openRouterClientError(status, json);
            return Response.json(
              { message: error.message },
              { status: error.status, headers: { "Cache-Control": "no-store" } },
            );
          }
          const image = result?.data?.[0];
          const mime = image?.media_type ?? "image/png";
          if (!image?.b64_json || !["image/png", "image/jpeg", "image/webp"].includes(mime)) {
            if (claimedGuest && ipHash) await releaseGuestLook(ipHash);
            return Response.json(
              {
                message:
                  "OpenRouter did not return a finished image. Your preview is still available.",
              },
              { status: 502 },
            );
          }
          if (supabaseAdmin) {
            await supabaseAdmin
              .from("shopper_events")
              .insert({
                event_type: "look_created",
                actor_type: userId ? "auth" : "guest",
                user_id: userId,
                catalog_product_id: catalogProductId,
                metadata: {
                  product_name: productName,
                  retailer,
                  audience,
                  price: Number.isFinite(price) && price > 0 ? price : null,
                },
              })
              .then(({ error }) => {
                if (error) console.error("[shoplook] look_created event failed", error.message);
              });
          }
          return Response.json(
            { image: `data:${mime};base64,${image.b64_json}` },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          if (claimedGuest && ipHash) await releaseGuestLook(ipHash);
          return Response.json(
            { message: "Could not reach OpenRouter right now. Your preview is still available." },
            { status: 502 },
          );
        }
      },
    },
  },
});
