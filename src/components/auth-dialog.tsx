import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export function AuthDialog({ open, onOpenChange, onSignedIn }: { open: boolean; onOpenChange: (open: boolean) => void; onSignedIn?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const result = mode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === "signup" && !result.data.session) { setMessage("Check your email to confirm your account, then sign in."); return; }
    onOpenChange(false); onSignedIn?.();
  };

  const google = async () => {
    setBusy(true); setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (!result.redirected) { onOpenChange(false); onSignedIn?.(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg">
        <DialogHeader><DialogTitle className="font-display text-3xl font-medium">{mode === "signin" ? "Welcome back" : "Join ShopLook"}</DialogTitle><DialogDescription>Save private looks and join the in-app style community.</DialogDescription></DialogHeader>
        <Button variant="outline" className="h-11" onClick={google} disabled={busy}>Continue with Google</Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-3">
          <Input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
          <Button className="h-11 w-full" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}{mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>
        <Button variant="link" className="h-auto" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}>{mode === "signin" ? "New here? Create an account" : "Already a member? Sign in"}</Button>
      </DialogContent>
    </Dialog>
  );
}