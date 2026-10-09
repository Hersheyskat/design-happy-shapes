import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LoaderCircle, ShoppingBag, X } from "lucide-react";

import { AuthDialog } from "@/components/auth-dialog";
import { ShopLookShell } from "@/components/shoplook-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyLooks } from "@/lib/community.functions";
import { recordShopperEvent } from "@/lib/shopper-events.functions";
import type { SavedLookDto } from "@/lib/community.types";

export const Route = createFileRoute("/saved-look/$lookId")({
  head: () => ({ meta: [
    { title: "Saved look — ShopLook" },
    { name: "description", content: "Revisit a private saved ShopLook and its styling notes." },
    { property: "og:title", content: "Saved look — ShopLook" },
    { property: "og:description", content: "Revisit a private saved ShopLook and its styling notes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SavedLookPage,
});

function SavedLookPage() {
  const { lookId } = Route.useParams();
  const list = useServerFn(listMyLooks);
  const trackEvent = useServerFn(recordShopperEvent);
  const [look, setLook] = useState<SavedLookDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [shopOpen, setShopOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setLoading(false); setAuthOpen(true); return; }
    try {
      const looks = await list();
      setLook(looks.find((item) => item.id === lookId) ?? null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "This saved look could not load."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [lookId]);

  function continueToShop() {
    if (!look?.productUrl) return;
    void trackEvent({ data: { eventType: "buy_click", catalogProductId: look.catalogProductId, savedLookId: look.id, channel: "retailer", metadata: { product_name: look.productName, retailer: look.productRetailer, price: look.productPrice, currency: look.productCurrency, product_url: look.productUrl } } }).catch(() => {});
    setShopOpen(false);
    window.open(look.productUrl, "_blank", "noopener,noreferrer");
  }

  return <ShopLookShell>
    <header className="flex h-16 items-center border-b border-border px-4"><Button asChild variant="ghost" size="icon"><Link to="/saved" aria-label="Back to saved looks"><ArrowLeft /></Link></Button><span className="ml-2 font-display text-2xl">Saved look</span></header>
    {loading ? <div className="grid place-items-center py-24"><LoaderCircle className="animate-spin text-primary" /></div> : look ? <>
      <div className="aspect-[2/3] bg-surface"><img src={look.shopperImageUrl} alt={look.advice.headline} className="size-full object-cover" /></div>
      <section className="px-5 pb-12 pt-6"><p className="text-xs font-semibold uppercase tracking-widest text-primary">{new Date(look.createdAt).toLocaleDateString()}</p><h1 className="mt-2 font-display text-4xl">{look.productName ?? look.advice.headline}</h1><div className="mt-5 border-y border-border py-4"><div className="flex items-center gap-2 text-primary"><h2 className="text-sm font-semibold">Stylist's take</h2></div><p className="mt-2 text-sm leading-6">{look.advice.summary}</p></div>
        {look.productImageUrl && <div className="mt-6 flex items-center gap-4 border-y border-border py-4"><img src={look.productImageUrl} alt="Saved product reference" className="size-20 rounded object-contain bg-surface" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Product reference</p><p className="mt-1 text-xs text-muted-foreground">The catalogue item used to create this look.</p></div>{look.productUrl && <Button size="sm" onClick={() => setShopOpen(true)}><ShoppingBag /> Shop</Button>}</div>}
      </section>
    </> : <section className="px-6 py-24 text-center"><h1 className="font-display text-3xl">Look unavailable</h1><p className="mt-3 text-sm text-muted-foreground">It may have been removed or belongs to another account.</p><Button asChild className="mt-6"><Link to="/saved">Back to saved looks</Link></Button></section>}
    {shopOpen && look?.productUrl && <div role="dialog" aria-modal="true" aria-label="Thank you for using ShopLook" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShopOpen(false); }}><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Thank you</h2><Button variant="ghost" size="icon" aria-label="Close" onClick={() => setShopOpen(false)}><X /></Button></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Thank you for using ShopLook. We&apos;ll take you to the retailer to continue shopping.</p><Button className="mt-5 h-12 w-full" onClick={continueToShop}><ShoppingBag /> Continue to {look.productRetailer ?? "retailer"}</Button><Button variant="outline" className="mt-2 h-11 w-full" onClick={() => setShopOpen(false)}>Stay on ShopLook</Button></div></div>}
    {message && <p role="alert" className="mx-5 rounded bg-destructive/5 p-3 text-sm text-destructive">{message}</p>}
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onSignedIn={() => { setLoading(true); void load(); }} />
  </ShopLookShell>;
}
