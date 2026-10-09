import { createFileRoute } from "@tanstack/react-router";

import { openRouterApiKey, openRouterPost } from "@/lib/openrouter.server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const Route = createFileRoute("/api/suggest-catalog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Request not allowed." }, { status: 403 });
        if (Number(request.headers.get("content-length") ?? 0) > 8_500_000) return Response.json({ message: "Choose a photo under 8 MB." }, { status: 413 });
        const form = await request.formData().catch(() => null);
        const photo = form?.get("photo");
        if (!(photo instanceof File) || !allowedTypes.has(photo.type) || photo.size === 0 || photo.size > 8_000_000) {
          return Response.json({ message: "Choose a JPG, PNG or WebP photo under 8 MB." }, { status: 400 });
        }
        const key = openRouterApiKey();
        if (!key) return Response.json({ message: "Photo suggestions are unavailable right now. Choose a catalogue below." }, { status: 503 });
        try {
          const encoded = Buffer.from(await photo.arrayBuffer()).toString("base64");
          const { status, json } = await openRouterPost("/api/v1/chat/completions", key, {
            model: "google/gemini-3.1-flash-lite",
            messages: [{ role: "user", content: [
              { type: "text", text: "You are suggesting which clothing catalogue best matches the VISIBLE outfit styling in this photo. Do NOT identify or infer the person's gender, sex, identity, age, or body. If the visible clothing clearly aligns more with one catalogue, reply with exactly MEN or WOMEN. If the clothing is neutral, ambiguous, not visible, or there is no person, reply with exactly UNSURE. No other words." },
              { type: "image_url", image_url: { url: `data:${photo.type};base64,${encoded}` } },
            ] }],
          });
          const result = json as { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } } | null;
          if (status < 200 || status >= 300) return Response.json({ message: result?.error?.message ?? "Photo suggestions are unavailable right now. Choose a catalogue below." }, { status: status === 429 ? 429 : 502, headers: { "Cache-Control": "no-store" } });
          const content = result?.choices?.[0]?.message?.content;
          const answer = typeof content === "string" ? content.trim().toUpperCase() : "";
          const audience = answer === "MEN" ? "men" : answer === "WOMEN" ? "women" : null;
          return Response.json({ audience }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ message: "Photo suggestions are unavailable right now. Choose a catalogue below." }, { status: 502, headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});