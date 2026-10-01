import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export function AuthDialog({ open, onOpenChange, onSignedIn }: { open: boolean; onOpenChange: (open: boolean) => void; onSignedIn?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");

  const sendCode = async () => {
    if (!email.trim()) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setStep("code"); setMessage("Check your email for a six-digit code. It expires shortly."); }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) { setMessage("Enter the six-digit code from your email."); return; }
    setBusy(true); setMessage(null);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
    setBusy(false);
    if (error || !data.session) { setMessage(error?.message ?? "That code has expired or is incorrect. Request a new one."); return; }
    onSignedIn?.(); onOpenChange(false);
    setStep("email"); setCode(""); setMessage(null);
  };

  const google = async () => {
    setBusy(true); setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (!result.redirected) { onSignedIn?.(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg">
        <DialogHeader><DialogTitle className="font-display text-3xl font-medium">Continue with ShopLook</DialogTitle><DialogDescription>Sign in with Google or an email code to heart, share, or shop your looks. Your profile is created automatically.</DialogDescription></DialogHeader>
        <Button className="h-12 w-full" onClick={google} disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} Continue with Google</Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
        {step === "email" ? <form onSubmit={(event) => { event.preventDefault(); void sendCode(); }} className="space-y-3"><label htmlFor="signin-email" className="text-sm font-medium">Email address</label><Input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy} /><Button type="submit" variant="outline" className="h-12 w-full" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} Send a sign-in code</Button></form> : <form onSubmit={(event) => { event.preventDefault(); void verifyCode(); }} className="space-y-3"><p className="text-sm text-muted-foreground">Code sent to {email}</p><label htmlFor="signin-code" className="text-sm font-medium">Six-digit code</label><Input id="signin-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" disabled={busy} /><Button type="submit" className="h-12 w-full" disabled={busy || code.length !== 6}>{busy && <LoaderCircle className="animate-spin" />} Verify code</Button><div className="flex justify-between"><Button type="button" variant="link" className="px-0" disabled={busy} onClick={() => { setStep("email"); setCode(""); setMessage(null); }}>Change email</Button><Button type="button" variant="link" className="px-0" disabled={busy} onClick={() => void sendCode()}>Resend code</Button></div></form>}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </DialogContent>
    </Dialog>
  );
}