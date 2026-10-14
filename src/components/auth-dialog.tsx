import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ensureMyProfile, saveMyName } from "@/lib/community.functions";

export function AuthDialog({
  open,
  onOpenChange,
  onSignedIn,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn?: () => void;
  description?: string;
}) {
  const loadProfile = useServerFn(ensureMyProfile);
  const persistName = useServerFn(saveMyName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [step, setStep] = useState<"email" | "code" | "name">("email");

  const reset = () => {
    setBusy(false);
    setMessage(null);
    setEmail("");
    setCode("");
    setFirstName("");
    setSurname("");
    setStep("email");
  };

  const finish = () => {
    onSignedIn?.();
    onOpenChange(false);
    reset();
  };

  const continueAfterSignIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const person = await loadProfile();
      if (person.first_name.trim() && person.surname.trim()) {
        finish();
        return;
      }
      setFirstName(person.first_name);
      setSurname(person.surname);
      setStep("name");
      setBusy(false);
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Could not set up your profile.");
    }
  };

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
    if (error || !data.session) {
      setBusy(false);
      setMessage(error?.message ?? "That code has expired or is incorrect. Request a new one.");
      return;
    }
    await continueAfterSignIn();
  };

  const saveName = async () => {
    const first = firstName.trim();
    const last = surname.trim();
    if (!first || !last) { setMessage("Enter your first name and surname."); return; }
    setBusy(true); setMessage(null);
    try {
      await persistName({ data: { firstName: first, surname: last } });
      await supabase.auth.updateUser({ data: { first_name: first, surname: last, full_name: `${first} ${last}` } });
      finish();
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Could not save your name.");
    }
  };

  const google = async () => {
    setBusy(true);
    setMessage(null);
    const popup = window.open("", "shoplook-google", "popup,width=480,height=720");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: popup
        ? { redirectTo: `${window.location.origin}/auth/callback`, skipBrowserRedirect: true }
        : { redirectTo: window.location.href },
    });
    if (error || (popup && !data.url)) {
      popup?.close();
      setBusy(false);
      setMessage(error?.message ?? "Google sign-in could not start.");
      return;
    }
    if (!popup || !data.url) return;

    popup.location.href = data.url;
    let done = false;
    let watch = 0;
    let closedChecks = 0;
    let unsubscribe = () => {};
    const wrappedFinish = (signedIn: boolean) => {
      if (done) return;
      done = true;
      window.clearInterval(watch);
      unsubscribe();
      if (!popup.closed) popup.close();
      if (!signedIn) {
        setBusy(false);
        return;
      }
      void continueAfterSignIn();
    };
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) wrappedFinish(true);
    });
    unsubscribe = () => authListener.subscription.unsubscribe();
    watch = window.setInterval(() => {
      if (!popup.closed) return;
      closedChecks += 1;
      if (closedChecks < 3) return;
      void supabase.auth.getSession().then(({ data: sessionData }) => wrappedFinish(Boolean(sessionData.session)));
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-medium">{step === "name" ? "Your name" : "Continue with ShopLook"}</DialogTitle>
          <DialogDescription>
            {step === "name"
              ? "Add your first name and surname so your profile belongs to you. You can edit this later."
              : description ||
                "Sign in with Google or an email code to keep creating looks, and to save, share, or shop. Your profile is created automatically."}
          </DialogDescription>
        </DialogHeader>
        {step === "name" ? (
          <form onSubmit={(event) => { event.preventDefault(); void saveName(); }} className="space-y-3">
            <label htmlFor="signin-first-name" className="text-sm font-medium">First name</label>
            <Input id="signin-first-name" autoComplete="given-name" required maxLength={30} value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" disabled={busy} />
            <label htmlFor="signin-surname" className="text-sm font-medium">Surname</label>
            <Input id="signin-surname" autoComplete="family-name" required maxLength={30} value={surname} onChange={(event) => setSurname(event.target.value)} placeholder="Surname" disabled={busy} />
            <Button type="submit" className="h-12 w-full" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} Save name</Button>
          </form>
        ) : (
          <>
            <Button className="h-12 w-full" onClick={google} disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} Continue with Google</Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
            {step === "email" ? (
              <form onSubmit={(event) => { event.preventDefault(); void sendCode(); }} className="space-y-3">
                <label htmlFor="signin-email" className="text-sm font-medium">Email address</label>
                <Input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy} />
                <Button type="submit" variant="outline" className="h-12 w-full" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} Send a sign-in code</Button>
              </form>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void verifyCode(); }} className="space-y-3">
                <p className="text-sm text-muted-foreground">Code sent to {email}</p>
                <label htmlFor="signin-code" className="text-sm font-medium">Six-digit code</label>
                <Input id="signin-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" disabled={busy} />
                <Button type="submit" className="h-12 w-full" disabled={busy || code.length !== 6}>{busy && <LoaderCircle className="animate-spin" />} Verify code</Button>
                <div className="flex justify-between">
                  <Button type="button" variant="link" className="px-0" disabled={busy} onClick={() => { setStep("email"); setCode(""); setMessage(null); }}>Change email</Button>
                  <Button type="button" variant="link" className="px-0" disabled={busy} onClick={() => void sendCode()}>Resend code</Button>
                </div>
              </form>
            )}
          </>
        )}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </DialogContent>
    </Dialog>
  );
}
