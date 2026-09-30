import { createFileRoute } from "@tanstack/react-router";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const attempts = new Map<string, number>();

export const Route = createFileRoute("/api/generate-look")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["GEMINI_API_KEY"];
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
        const client = request.headers.get("cf-connecting-ip") ?? "preview";
        const last = attempts.get(client) ?? 0;
        if (Date.now() - last < 30_000) return Response.json({ message: "Please wait a moment before making another AI look." }, { status: 429 });
        attempts.set(client, Date.now());

        const encode = async (file: File) => Buffer.from(await file.arrayBuffer()).toString("base64");
        try {
          const [personData, garmentData] = await Promise.all([encode(person), encode(garment)]);
          const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              model: "gemini-3.1-flash-image",
              input: [
                { type: "text", text: `Create a tasteful photorealistic fashion styling visualization. Reference image 1 is the shopper photo: preserve the person, their face, pose, body shape, background and framing. Reference image 2 is the garment: show that apparel on the person, matching the reference garment's color, shape and texture as closely as possible. Do not change the person's identity or add text or logos. Style direction from shopper: ${note.trim() || "natural everyday styling"}. This is a visual styling suggestion, not a fitting or sizing prediction.` },
                { type: "image", mime_type: person.type, data: personData },
                { type: "image", mime_type: garment.type, data: garmentData },
              ],
            }),
          });
          const result = await upstream.json().catch(() => null) as { output_image?: { data?: string; mime_type?: string }; error?: { message?: string } } | null;
          if (!upstream.ok) {
            const fallback = upstream.status === 429 ? "Google is busy. Please try again later." : "Google could not make this look right now.";
            return Response.json({ message: result?.error?.message ?? fallback }, { status: upstream.status });
          }
          const image = result?.output_image;
          const mime = image?.mime_type ?? "image/png";
          if (!image?.data || !["image/png", "image/jpeg", "image/webp"].includes(mime)) {
            return Response.json({ message: result?.error?.message ?? "Google did not return a finished image. Your preview is still available." }, { status: 502 });
          }
          return Response.json({ image: `data:${mime};base64,${image.data}` }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ message: "Could not reach Google right now. Your preview is still available." }, { status: 502 });
        }
      },
    },
  },
});