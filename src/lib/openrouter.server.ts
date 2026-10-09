import { connect } from "node:tls";

type OpenRouterErrorBody = { error?: { message?: string }; message?: string };

export function openRouterApiKey() {
  return process.env["OPENROUTER_API_KEY"]?.trim().replace(/^["']|["']$/g, "") || "";
}

function decodeChunked(body: Buffer) {
  const parts: Buffer[] = [];
  let offset = 0;
  while (offset < body.length) {
    const lineEnd = body.indexOf("\r\n", offset);
    if (lineEnd < 0) break;
    const size = Number.parseInt(body.subarray(offset, lineEnd).toString("ascii"), 16);
    if (!Number.isFinite(size) || size < 0) break;
    if (size === 0) break;
    const start = lineEnd + 2;
    parts.push(body.subarray(start, start + size));
    offset = start + size + 2;
  }
  return Buffer.concat(parts);
}

export function openRouterPost(path: string, apiKey: string, body: unknown) {
  const payload = Buffer.from(JSON.stringify(body));
  const requestPath = path.startsWith("/") ? path : `/api/v1/${path}`;
  const head = [
    `POST ${requestPath} HTTP/1.1`,
    "Host: openrouter.ai",
    "Content-Type: application/json",
    `Authorization: Bearer ${apiKey}`,
    `Content-Length: ${payload.length}`,
    "Connection: close",
    "",
    "",
  ].join("\r\n");
  const request = Buffer.concat([Buffer.from(head, "ascii"), payload]);

  return new Promise<{ status: number; json: unknown }>((resolve, reject) => {
    const socket = connect({ host: "openrouter.ai", port: 443, servername: "openrouter.ai" }, () => {
      socket.write(request);
    });
    socket.setTimeout(120_000, () => {
      socket.destroy();
      reject(new Error("OpenRouter timed out."));
    });
    const chunks: Buffer[] = [];
    socket.on("data", (chunk) => chunks.push(chunk as Buffer));
    socket.on("error", reject);
    socket.on("end", () => {
      const raw = Buffer.concat(chunks);
      const split = raw.indexOf("\r\n\r\n");
      if (split < 0) {
        resolve({ status: 502, json: { error: { message: "OpenRouter returned an empty response." } } });
        return;
      }
      const headerText = raw.subarray(0, split).toString("latin1");
      let responseBody = raw.subarray(split + 4);
      const status = Number(headerText.split(" ")[1]) || 502;
      if (/transfer-encoding:\s*chunked/i.test(headerText)) responseBody = decodeChunked(responseBody);
      const text = responseBody.toString("utf8").trim();
      try {
        resolve({ status, json: JSON.parse(text) as unknown });
      } catch {
        resolve({ status, json: { error: { message: text.slice(0, 280) } } });
      }
    });
  });
}

export function openRouterClientError(status: number, json: unknown) {
  const body = json as OpenRouterErrorBody;
  const message = body?.error?.message?.trim() || body?.message?.trim();
  if (status === 429) return { status: 429, message: "OpenRouter is busy. Please try again later." };
  if (status === 402) return { status: 402, message: message || "AI looks are paused until credits are available." };
  if (status === 401 || status === 403) return { status: 502, message: "Could not reach the look generator right now. Please try again." };
  if (message) return { status: 502, message };
  return { status: 502, message: "OpenRouter could not make this look right now." };
}
