import { createFileRoute } from "@tanstack/react-router";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const attempts = new Map<string, number>();

function stylingPrompt() {
  return `Create ONE photorealistic full-body image of the SAME PERSON from reference image 1 WEARING the featured garment from reference image 2. Reference 1 is the shopper: preserve their face, identity, skin tone, body shape and natural proportions; keep their pose and background where possible. Reference 2 shows the catalog item, possibly worn by a different model: use it ONLY to identify the garment, its color, cut and texture. Dress the shopper in that item realistically, adapting the garment to their body and existing pose, regardless of whether the catalog model has a different gender or appearance. Never copy the catalog model's face or body. The output must be a SINGLE unified image of the shopper in the item, NOT a collage, side-by-side comparison, split-screen, product photo, or before-and-after layout. Do not add text or logos. Shopper style direction: natural everyday styling. This is a visual styling suggestion, not a fitting or sizing prediction.`;
}

function tryonPrompt(productName: string) {
  const category = garmentCategory(productName);
  return `TASK
Create one photorealistic virtual try-on by editing the shopper photo. Dress the same shopper in the exact selected clothing from the product reference, replacing the appropriate existing garments completely.

REFERENCE ROLES
Image 1 — SHOPPER: the original photograph to edit. It determines the person, face, expression, hair, skin tone, body proportions, pose, hands, camera viewpoint, lighting, background and framing.

Image 2 — PRODUCT: the appearance reference for the selected clothing only. Do not transfer the catalogue model’s identity, body, pose, background, accessories or unrelated garments.

SELECTED PRODUCT
Name: ${productName.trim()}${category ? `\nCategory: ${category}` : ""}

SOURCE CLOTHING
Identify the existing clothing in Image 1 from what is visible; do not invent hidden details.

REPLACEMENT RULES
Identify which existing garments the selected clothing replaces:
- A shirt, T-shirt or blouse replaces the existing top.
- Trousers, shorts or a skirt replace the existing bottoms.
- A dress, jumpsuit or other one-piece replaces the existing one-piece, or both the existing top and bottoms.
- Outerwear replaces the existing outer layer, preserving appropriate inner clothing. If no outer layer exists, add the selected outerwear over the existing outfit.
- A matching set replaces the corresponding garments explicitly included in the selected product.

Preserve unrelated clothing. Do not copy additional garments from the catalogue image unless they are explicitly included in the selected product.

EDIT SCOPE
Replace all identified source garments across their entire visible extent, including every panel and edge through the hem or image boundary.

Treat differently coloured or patterned panels belonging to a source garment as part of that same garment. A change in colour, pattern, lighting or fold does not establish a separate garment.

Render the selected clothing with consistent construction across the entire garment, appropriate to its category. Do not combine the selected garment’s upper section with the original garment’s lower section, or leave remnants of replaced clothing at the waist, neckline, sleeves, cuffs or hem.

PRODUCT FIDELITY
Follow Image 2 for colour, visible texture, pattern, silhouette, length and hem, plus neckline, collar, closures, pockets, seams, sleeves and cuffs where applicable.

Adapt the clothing’s drape and perspective to the shopper’s existing body and pose. Preserve the product’s design rather than copying the catalogue model’s body shape.

Preserve visible branding belonging to the selected clothing. Add no invented logos, text, embellishments or styling changes.

GARMENT BOUNDARIES
Use the selected garment’s own fabric consistently across its panels, folds, sleeves and rolled cuffs, where applicable.

Where the selected clothing changes coverage, render the anatomically and physically appropriate skin, retained clothing or background. Do not retain replaced fabric in those areas or invent additional underlayers.

Preserve foreground hands, hair and accessories in their correct positions and depth order. Clothing must pass naturally behind them where appropriate.

PRESERVE THE PHOTOGRAPH
Keep the shopper’s identity, facial features, expression, body proportions and pose unchanged.

Preserve unrelated clothing, shoes, accessories and background, except for areas necessarily affected by the new clothing’s silhouette, coverage or shadows.

Match the original camera distance, person scale, orientation and framing. Preserve all originally visible body parts. Do not zoom, crop, extend the body beyond the original frame, beautify the face or reshape the person.

If a garment extends beyond the original image boundary, let it continue naturally out of frame rather than shortening it or inventing a wider view.

OUTPUT
Return one unified edited photograph matching the original photo’s framing. No collage, comparison panel, catalogue model, caption or decorative border.`;
}

// Only classify a garment when its name explicitly identifies the item.
function garmentCategory(name: string): string | null {
  if (/\b(co-ord|coord|two.piece|2.piece|matching set|pant set|suit set)\b/i.test(name)) return "matching set";
  if (/\b(dress|jumpsuit)\b/i.test(name)) return /\bjumpsuit\b/i.test(name) ? "jumpsuit" : "dress";
  if (/\b(jacket|shacket|overshirt|blazer|coat)\b/i.test(name)) return "outerwear";
  if (/\b(trousers|pants|jeans|shorts|skirt)\b/i.test(name)) return "bottoms";
  if (/\b(shirt|t-shirt|tee|polo|blouse|kurta)\b/i.test(name)) return "top";
  return null;
}

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
        const mode = form?.get("mode");
        if (!(person instanceof File) || !(garment instanceof File) || !imageTypes.has(person.type) || !imageTypes.has(garment.type) || person.size > 8_000_000 || garment.size > 4_000_000 || typeof productName !== "string" || !productName.trim() || productName.length > 180 || (mode !== "styling" && mode !== "tryon")) {
          return Response.json({ message: "Choose valid JPG, PNG or WebP images and try again." }, { status: 400 });
        }
        const client = request.headers.get("cf-connecting-ip") ?? "preview";
        const last = attempts.get(client) ?? 0;
        if (Date.now() - last < 3_000) return Response.json({ message: "Please wait a moment before making another AI look." }, { status: 429 });
        attempts.set(client, Date.now());

        const encode = async (file: File) => Buffer.from(await file.arrayBuffer()).toString("base64");
        try {
          const [personData, garmentData] = await Promise.all([encode(person), encode(garment)]);
          const upstream = await fetch("https://openrouter.ai/api/v1/images", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-image",
              prompt: mode === "styling" ? stylingPrompt() : tryonPrompt(productName),
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