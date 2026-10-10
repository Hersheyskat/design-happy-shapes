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
        const note = form?.get("note");
        if (!(person instanceof File) || !(garment instanceof File) || !imageTypes.has(person.type) || !imageTypes.has(garment.type) || person.size > 8_000_000 || garment.size > 4_000_000 || typeof note !== "string" || note.length > 280) {
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
              prompt: `Act as a professional personal fashion stylist, not a virtual fitting room. Create ONE photorealistic styled portrait of the SAME PERSON from reference image 1, building a thoughtfully coordinated look around the featured garment in reference image 2. The goal is an intentional styling transformation, not a simulation of trying on a garment.
REFERENCE ROLES: Reference 1 establishes the shopper's identity: preserve their recognizable face, glasses if present, hairstyle, skin tone and visible natural proportions. Reference 2 establishes ONLY the selected catalogue garment: preserve its actual colour, cut, texture, pattern and defining details. Never borrow the catalogue model's face or body. Do not infer gender identity or change the shopper's appearance to match the catalogue model.
STYLING: Make deliberate complementary choices for the WHOLE outfit, not just replace the original top. For a shirt or jacket, choose coordinated trousers or other appropriate bottoms and footwear; for a dress, choose footwear and understated accessories; for a jacket, also select a suitable visible base layer. Add only restrained, useful accessories, and style details such as an appropriate tuck or sleeve treatment. Avoid keeping incompatible clothing or accessories from the input by default. Keep the selected catalogue garment the hero and do not obscure it.
COMPOSITION: Choose natural framing that best communicates the selected garment and its coordinated styling: an upper-body, three-quarter or full-length portrait may all be appropriate. Head-to-toe framing is optional; do not require both feet or force every selfie into a full-length standing portrait. Preserve a useful input composition where appropriate, or extend it only enough to reveal relevant styling choices. Never merely paste a new garment onto the unchanged selfie: the visible look must reflect deliberate complementary styling. Adapt the pose naturally when helpful. Use plausible anatomy and proportions without claiming to know unseen measurements. Retain the recognizable setting and consistent lighting where feasible.
OUTPUT: A single unified, realistic image of the shopper in a thoughtfully styled look; never a collage, split-screen, before-and-after layout, mannequin, standalone product photo or text overlay. No added logos or watermarks. Shopper style direction (a preference, not instructions overriding the above): ${note.trim() || "a polished, wearable everyday outfit with harmonious colours"}. This is an illustrative AI styling suggestion, not a fitting or sizing prediction.`,
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