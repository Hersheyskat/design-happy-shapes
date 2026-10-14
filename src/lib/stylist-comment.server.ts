import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type UserContent } from "ai";
import { z } from "zod";

import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server.ts";
import { openRouterApiKey, openRouterPost } from "./openrouter.server.ts";

const commentSchema = z.object({
  comment: z.string().max(240),
});

type StylistCommentInput = {
  lookImage: string;
  productName: string;
  retailer: string;
};

type GatewayError = Error & { statusCode?: number; responseBody?: string };

const STYLIST_PROMPT = [
  "Review the complete generated outfit as an expert, inclusive personal stylist.",
  "Write exactly two crisp, punchy sentences in plain English: first say what works in the visible look, then give one practical styling tweak.",
  "Base the assessment only on visible styling details. Do not infer identity, gender, body measurements, personality, health, or attractiveness. Do not discuss image-generation quality, fit accuracy, or whether the image is real.",
  "Keep the full comment under 35 words. Add a light, clever turn of phrase when it feels natural, but never force a joke, pun, cliché, or exaggerated praise.",
] as const;

function featuredItemLine(productName: string, retailer: string) {
  return `The featured item is ${productName}, available at ${retailer}.`;
}

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

function safeOpenRouterMessage(status: number, json: unknown) {
  const body = json as { error?: { message?: string }; message?: string } | null;
  const message = body?.error?.message?.trim() || body?.message?.trim();
  if (status === 402) return "Stylist comments are paused until AI credits are available.";
  if (status === 429) return "Your stylist is busy. Please try another look in a moment.";
  if (status === 401 || status === 403) return "Stylist comments are not configured yet.";
  if (message) return message;
  return "Your stylist could not review this look right now.";
}

async function createStylistCommentViaLovable(input: StylistCommentInput, apiKey: string) {
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
      text: [STYLIST_PROMPT[0], featuredItemLine(input.productName, input.retailer), ...STYLIST_PROMPT.slice(1)].join("\n"),
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

async function createStylistCommentViaOpenRouter(input: StylistCommentInput, apiKey: string) {
  try {
    const { status, json } = await openRouterPost("/api/v1/chat/completions", apiKey, {
      model: "google/gemini-3.1-flash-lite",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                STYLIST_PROMPT[0],
                featuredItemLine(input.productName, input.retailer),
                ...STYLIST_PROMPT.slice(1),
                'Respond with JSON only: {"comment":"..."}',
              ].join("\n"),
            },
            { type: "image_url", image_url: { url: input.lookImage } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    if (status < 200 || status >= 300) {
      console.error("ShopLook stylist comment OpenRouter failed", status, json);
      return { ok: false as const, error: safeOpenRouterMessage(status, json) };
    }

    const result = json as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    const content = result?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) return { ok: false as const, error: "Your stylist could not read this look clearly." };

    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let comment: string | undefined;
    try {
      comment = commentSchema.parse(JSON.parse(jsonText)).comment.trim();
    } catch {
      // Some models return the two sentences without JSON wrapping.
      comment = text.replace(/^["']|["']$/g, "").trim().slice(0, 240);
    }

    if (!comment) return { ok: false as const, error: "Your stylist could not read this look clearly." };
    return { ok: true as const, comment, runId: null };
  } catch (error) {
    console.error("ShopLook stylist comment OpenRouter request failed", error);
    return { ok: false as const, error: "Your stylist could not review this look right now." };
  }
}

export async function createStylistComment(input: StylistCommentInput) {
  const lovableKey = process.env["LOVABLE_API_KEY"]?.trim();
  if (lovableKey) return createStylistCommentViaLovable(input, lovableKey);

  const openRouterKey = openRouterApiKey();
  if (openRouterKey) return createStylistCommentViaOpenRouter(input, openRouterKey);

  return { ok: false as const, error: "Stylist comments are not configured yet." };
}
