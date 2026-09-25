import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type UserContent } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server.ts";
import type { StyleAdvice } from "./style-advice.types.ts";

const adviceSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  colors: z.array(
    z.object({
      name: z.string(),
      hex: z.string(),
      use: z.string(),
    }),
  ),
  adjustments: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
    }),
  ),
  shoppingItems: z.array(
    z.object({
      label: z.string(),
      searchTerm: z.string(),
      reason: z.string(),
    }),
  ),
});

type AnalysisInput = {
  shopperImage: string;
  shopperMime: string;
  productImage: string | null;
  productMime: string | null;
  productUrl: string | null;
  mood: "minimal" | "street" | "classic" | "romantic" | "sporty";
};

type GatewayError = Error & { statusCode?: number; responseBody?: string };

function safeGatewayMessage(error: unknown) {
  const gatewayError = error as GatewayError;
  if (gatewayError.responseBody) {
    try {
      const body = JSON.parse(gatewayError.responseBody) as { message?: unknown; error?: { message?: unknown } };
      const message = body.message ?? body.error?.message;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // The provider response was not JSON; use the status-specific message below.
    }
  }
  if (gatewayError.statusCode === 402) return "AI credits are currently unavailable. Add credits, then try again.";
  if (gatewayError.statusCode === 429) return "ShopLook is receiving many requests. Please wait a moment and try again.";
  if (gatewayError.statusCode === 401) return "AI styling is not configured for this project yet.";
  return gatewayError.message || "ShopLook could not analyse these images. Please try again.";
}

export async function createStyleAdvice(input: AnalysisInput) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false as const, error: "AI styling is not configured for this project yet." };

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const content: UserContent = [
    {
      type: "text",
      text: [
        "Act as a concise, inclusive fashion stylist. Analyse the shopper's complete outfit and the product they are considering.",
        "This is look comparison and styling advice, never virtual try-on. Do not claim the product was placed on the person.",
        `Build the advice around a ${input.mood} style mood.`,
        "Return exactly 4 complementary colors, exactly 3 practical styling adjustments, and exactly 3 supporting items to shop for.",
        "For each supporting item, provide a short label, an India-friendly retail search phrase, and one concise reason it completes this look.",
        "Color hex values must be valid six-digit hex colors. Keep every title short and every detail to one sentence.",
        input.productUrl ? `The shopper also supplied this product page as context: ${input.productUrl}` : "A product screenshot follows the outfit photo.",
      ].join("\n"),
    },
    { type: "file", data: { type: "url", url: new URL(input.shopperImage) }, mediaType: input.shopperMime },
  ];

  if (input.productImage && input.productMime) {
    content.push({ type: "file", data: { type: "url", url: new URL(input.productImage) }, mediaType: input.productMime });
  }

  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      messages: [{ role: "user", content }],
      maxRetries: 0,
      output: Output.object({ schema: adviceSchema, name: "shoplook_style_advice" }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const output = await result.output;
    if (!output) return { ok: false as const, error: "ShopLook could not read this outfit clearly. Try a brighter, full-outfit photo." };

    return {
      ok: true as const,
      advice: {
        ...output,
        colors: output.colors.slice(0, 4),
        adjustments: output.adjustments.slice(0, 3),
        shoppingItems: output.shoppingItems.slice(0, 3).map((item) => ({
          ...item,
          destinationUrl: `https://www.google.com/search?tbm=shop&gl=in&q=${encodeURIComponent(item.searchTerm)}`,
        })),
      },
      runId: runIdFetch.getRunId() ?? null,
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("ShopLook AI output validation failed", error);
      return { ok: false as const, error: "ShopLook could not format the styling notes. Please try again." };
    }
    console.error("ShopLook AI request failed", error);
    return { ok: false as const, error: safeGatewayMessage(error) };
  }
}