import { createFileRoute } from "@tanstack/react-router";

import { clientIpHash, FREE_LOOKS, peekGuestLookRemaining } from "@/lib/guest-look-quota.server";

function signedInFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token || token.split(".").length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { sub?: unknown; exp?: unknown; role?: unknown };
    if (typeof payload.sub !== "string" || !payload.sub || payload.role === "anon") return false;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now() - 30_000) return false;
    return true;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/guest-look-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) {
          return Response.json({ message: "Request not allowed." }, { status: 403 });
        }

        if (signedInFromRequest(request)) {
          return Response.json(
            { signedIn: true, remaining: null, freeLooks: FREE_LOOKS },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          // Without quota infra, guests must sign in instead of generating freely.
          return Response.json(
            { signedIn: false, remaining: 0, freeLooks: FREE_LOOKS, requireLogin: true },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        try {
          const remaining = await peekGuestLookRemaining(clientIpHash(request));
          return Response.json(
            {
              signedIn: false,
              remaining,
              freeLooks: FREE_LOOKS,
              requireLogin: remaining <= 0,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            { signedIn: false, remaining: 0, freeLooks: FREE_LOOKS, requireLogin: true },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
