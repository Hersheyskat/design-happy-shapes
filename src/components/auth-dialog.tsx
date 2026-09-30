import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lovable } from "@/integrations/lovable";

export function AuthDialog({ open, onOpenChange, onSignedIn }: { open: boolean; onOpenChange: (open: boolean) => void; onSignedIn?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        <DialogHeader><DialogTitle className="font-display text-3xl font-medium">Continue with ShopLook</DialogTitle><DialogDescription>Sign in to heart, save, share, or shop your looks. Your profile is created automatically.</DialogDescription></DialogHeader>
        <Button className="h-12 w-full" onClick={google} disabled={busy}>{busy && <LoaderCircle className="animate-spin" />} Continue with Google</Button>
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </DialogContent>
    </Dialog>
  );
}