import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const description = new URLSearchParams(window.location.search).get("error_description");
    if (description) {
      setMessage(description);
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (window.opener) {
        window.close();
        return;
      }
      void navigate({ to: "/" });
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) finish();
    });

    void supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (error) setMessage(error.message);
      else if (sessionData.session) finish();
    });

    const timeout = window.setTimeout(() => {
      if (!finished) setMessage("Google sign-in did not finish. Close this window and try again.");
    }, 12_000);

    return () => {
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <p role="status" className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
