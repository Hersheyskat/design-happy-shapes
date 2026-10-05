import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type UserContent } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server.ts";

const commentSchema = z.object({
  comment: z.string().max(240),
});

type StylistCommentInput = {
  lookImage: string;
  productName: string;
  retailer: string;
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
      // Use the status-specific message below when the response is not JSON.
    }
  }
  if (gatewayError.statusCode === 402) return "Stylist comments are paused until AI credits are available.";
  if (gatewayError.statusCode === 429) return "Your stylist is busy. Please try another look in a moment.";
  if (gatewayError.statusCode === 401) return "Stylist comments are not configured yet.";
  return "Your stylist could not review this look right now.";
}

export async function createStylistComment(input: StylistCommentInput) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false as const, error: "Stylist comments are not configured yet." };

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
        "Review the complete generated outfit as an expert, inclusive personal stylist.",
        `The featured item is ${input.productName}, available at ${input.retailer}.`,
        "Write exactly two crisp, punchy sentences in plain English: first say what works in the visible look, then give one practical styling tweak.",
        "Base the assessment only on visible styling details. Do not infer identity, gender, body measurements, personality, health, or attractiveness. Do not discuss image-generation quality, fit accuracy, or whether the image is real.",
        "Keep the full comment under 35 words. Add a light, clever turn of phrase when it feels natural, but never force a joke, pun, cliché, or exaggerated praise.",
      ].join("\n"),
    },
    { type: "file", data: { type: "url", url: new URL(input.lookImage) }, mediaType: input.lookImage.slice(5, input.lookImage.indexOf(";")) },
  ];

  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      messages: [{ role: "user", content }],
      maxRetries: 0,
      output: Output.object({ schema: commentSchema, name: "shoplook_stylist_comment" }),
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
    const comment = output?.comment.trim();
    if (!comment) return { ok: false as const, error: "Your stylist could not read this look clearly." };
    return { ok: true as const, comment, runId: runIdFetch.getRunId() ?? null };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("ShopLook stylist comment validation failed", error);
      return { ok: false as const, error: "Your stylist could not format this review." };
    }
    console.error("ShopLook stylist comment request failed", error);
    return { ok: false as const, error: safeGatewayMessage(error) };
  }
}