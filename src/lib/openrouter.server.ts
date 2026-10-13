import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type OpenRouterErrorBody = { error?: { message?: string; code?: number }; message?: string };

function cleanKey(value: string | undefined | null) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

function keyFromDotEnv() {
  try {
    const path = resolve(process.cwd(), ".env");
    if (!existsSync(path)) return "";
    const line = readFileSync(path, "utf8")
      .split("\n")
      .find((entry) => entry.startsWith("OPENROUTER_API_KEY="));
    return line ? cleanKey(line.slice("OPENROUTER_API_KEY=".length)) : "";
  } catch {
    return "";
  }
}

export function openRouterApiKey() {
  // Prefer project .env so a stale shell/platform key cannot silently win in local dev.
  // Production hosts without a .env file still use process.env / platform secrets.
  return keyFromDotEnv() || cleanKey(process.env["OPENROUTER_API_KEY"]);
}

export async function openRouterPost(path: string, apiKey: string, body: unknown) {
  const requestPath = path.startsWith("/") ? path : `/api/v1/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`https://openrouter.ai${requestPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shoplook.ai",
        "X-OpenRouter-Title": "ShopLook",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      json = { error: { message: text.slice(0, 280) } };
    }
    return { status: response.status, json };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("OpenRouter timed out.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function openRouterClientError(status: number, json: unknown) {
  const body = json as OpenRouterErrorBody;
  const message = body?.error?.message?.trim() || body?.message?.trim();
  if (status === 429) return { status: 429, message: "OpenRouter is busy. Please try again later." };
  if (status === 402) return { status: 402, message: message || "AI looks are paused until credits are available." };
  if (status === 401 || status === 403) {
    console.error("[shoplook] openrouter auth failed", status, message || "(no message)");
    return {
      status: 502,
      message: message || "Could not reach the look generator right now. Please try again.",
    };
  }
  if (message) return { status: 502, message };
  return { status: 502, message: "OpenRouter could not make this look right now." };
}
