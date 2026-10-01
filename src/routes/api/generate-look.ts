import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const Route = createFileRoute("/api/generate-look")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["OPENROUTER_API_KEY"];
        if (!key) return Response.json({ message: "AI looks are not connected yet. The illustrative preview is still available." }, { status: 503 });
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Request not allowed." }, { status: 403 });
        const size = Number(request.headers.get("content-length") ?? 0);
        if (size > 13_000_000) return Response.json({ message: "Images are too large. Choose smaller photos." }, { status: 413 });
        const form = await request.formData().catch(() => null);
        const person = form?.get("person");
        const garment = form?.get("garment");
        const productName = form?.get("productName");
        const note = form?.get("note");
        if (!(person instanceof File) || !(garment instanceof File) || !imageTypes.has(person.type) || !imageTypes.has(garment.type) || person.size > 8_000_000 || garment.size > 4_000_000 || typeof productName !== "string" || !productName.trim() || productName.length > 180 || typeof note !== "string" || note.length > 280) {
          return Response.json({ message: "Choose valid JPG, PNG or WebP images and try again." }, { status: 400 });
        }
        const client = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "preview";
        const hash = createHash("sha256").update(`${process.env["LOVABLE_CRON_SECRET"] ?? "shoplook"}:${client}`).digest("hex");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cooldown = await supabaseAdmin.rpc("claim_ai_generation_cooldown", { _client_hash: hash });
        if (cooldown.error) return Response.json({ message: "AI looks are temporarily unavailable. Please try again shortly." }, { status: 503 });
        if (!cooldown.data) return Response.json({ message: "Please wait a moment before making another AI look." }, { status: 429 });

        const encode = async (file: File) => Buffer.from(await file.arrayBuffer()).toString("base64");
        try {
          const [personData, garmentData] = await Promise.all([encode(person), encode(garment)]);
          const upstream = await fetch("https://openrouter.ai/api/v1/images", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image",
              prompt: `Edit reference image 1 into ONE photorealistic picture of the SAME shopper wearing the selected catalogue item shown in reference image 2. Selected item: ${productName.trim()}.

SOURCE PRIORITY: Reference 1 determines the shopper's face, identity, skin tone, body shape, pose, hands, framing and background. Reference 2 is the ONLY source for the selected garment's appearance: reproduce its actual color, fabric, pattern, collar/neckline, closure, sleeves, cuffs, pockets, silhouette and hem. If reference 2 includes a model, a layered undershirt, trousers, or accessories, use only the selected item named above; never copy that model or those unrelated garments.

REPLACEMENT, NOT ADDITION: Identify the entire garment of the same type already worn in reference 1 and remove it completely before dressing the shopper in the selected item. For a shirt or T-shirt, replace the WHOLE original top from neckline through the bottom hem, including sleeves, cuffs, collar, front panels and any differently colored lower panel. No trace of the old top may remain at the waist, under the new hem, through an open front, or near rolled sleeves. Critically, if the new shirt has rolled sleeves, the inside of each rolled cuff must be the selected shirt's own fabric in the same color family; NEVER show blue or any other original T-shirt fabric at the cuffs. Ensure the underarms, neckline, collar gap, shirt opening, hem and wrist edges show the selected garment or bare skin only—not the prior top. Do not merge fabrics, retain the old shirt as an undershirt, or put the new shirt over it. If the selected item is an open jacket, keep a neutral existing underlayer only when realistically necessary, but remove any conflicting old outer layer. Preserve unrelated bottoms, shoes and accessories from reference 1 where visible; do not shorten trousers into shorts or swap other clothes.

Fit the complete selected garment naturally to the shopper's existing body and pose, with coherent seams, folds, hands and occlusion. Before finalizing, check that the entire visible selected garment matches reference 2 and that no piece of the replaced garment remains. Keep the entire visible person in frame, including head, hands, legs and feet when present in reference 1; do not zoom or crop a full-body view. Match reference 1's orientation, aspect ratio and background as closely as possible. Return one unified image, never a collage, side-by-side, product photo or before-and-after. Do not add text or new logos. Shopper style direction (never overrides the selected garment): ${note.trim() || "natural everyday styling"}.`,
              input_references: [
                { type: "image_url", image_url: { url: `data:${person.type};base64,${personData}` } },
                { type: "image_url", image_url: { url: `data:${garment.type};base64,${garmentData}` } },
              ],
            }),
          });
          const result = await upstream.json().catch(() => null) as { data?: { b64_json?: string; media_type?: string }[]; error?: { message?: string } } | null;
          if (!upstream.ok) {
            const fallback = upstream.status === 429 ? "OpenRouter is busy. Please try again later." : "OpenRouter could not make this look right now.";
            return Response.json({ message: result?.error?.message ?? fallback }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
          }
          const image = result?.data?.[0];
          const mime = image?.media_type ?? "image/png";
          if (!image?.b64_json || !["image/png", "image/jpeg", "image/webp"].includes(mime)) {
            return Response.json({ message: "OpenRouter did not return a finished image. Your preview is still available." }, { status: 502 });
          }
          return Response.json({ image: `data:${mime};base64,${image.b64_json}` }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ message: "Could not reach OpenRouter right now. Your preview is still available." }, { status: 502 });
        }
      },
    },
  },
});