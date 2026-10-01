import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LoaderCircle, ShoppingBag, ZoomIn, ZoomOut } from "lucide-react";

import { AuthDialog } from "@/components/auth-dialog";
import { ShopLookShell } from "@/components/shoplook-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyLooks } from "@/lib/community.functions";
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
  const [look, setLook] = useState<SavedLookDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [zoomed, setZoomed] = useState(false);

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

  return <ShopLookShell>
    <header className="flex h-16 items-center border-b border-border px-4"><Button asChild variant="ghost" size="icon"><Link to="/saved" aria-label="Back to saved looks"><ArrowLeft /></Link></Button><span className="ml-2 font-display text-2xl">Saved look</span></header>
    {loading ? <div className="grid place-items-center py-24"><LoaderCircle className="animate-spin text-primary" /></div> : look ? <>
       <Button type="button" variant="ghost" className="relative block h-[50dvh] min-h-[320px] max-h-[540px] w-full rounded-none bg-surface p-0" aria-label="Enlarge saved photo" onClick={() => setExpanded(true)}><img src={look.shopperImageUrl} alt={look.advice.headline} className="absolute inset-0 size-full object-contain" /></Button>
      <section className="px-5 pb-12 pt-6"><p className="text-xs font-semibold uppercase tracking-widest text-primary">{look.mood} · {new Date(look.createdAt).toLocaleDateString()}</p><h1 className="mt-2 font-display text-4xl">{look.advice.headline}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{look.advice.summary}</p>
        {look.productImageUrl && <div className="mt-6 flex items-center gap-4 border-y border-border py-4"><img src={look.productImageUrl} alt="Saved product reference" className="size-20 rounded object-contain bg-surface" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Product reference</p><p className="mt-1 text-xs text-muted-foreground">The catalogue item used to create this look.</p></div>{look.productUrl && <Button asChild size="sm"><a href={look.productUrl} target="_blank" rel="noopener noreferrer"><ShoppingBag /> Shop</a></Button>}</div>}
        <h2 className="mt-7 font-display text-2xl">Styling notes</h2><ul className="mt-3 space-y-4">{look.advice.adjustments.map((item) => <li key={item.title}><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p></li>)}</ul>
      </section>
    </> : <section className="px-6 py-24 text-center"><h1 className="font-display text-3xl">Look unavailable</h1><p className="mt-3 text-sm text-muted-foreground">It may have been removed or belongs to another account.</p><Button asChild className="mt-6"><Link to="/saved">Back to saved looks</Link></Button></section>}
     {expanded && <div role="dialog" aria-modal="true" aria-label="Saved photo" className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onClick={() => { setExpanded(false); setZoomed(false); }}><div className="relative max-h-[90dvh] w-full max-w-3xl overflow-auto bg-background p-3 pt-12" onClick={(event) => event.stopPropagation()}><Button type="button" variant="ghost" size="icon" className="absolute left-3 top-2" aria-label={zoomed ? "Zoom out" : "Zoom in"} onClick={() => setZoomed((current) => !current)}>{zoomed ? <ZoomOut /> : <ZoomIn />}</Button><Button type="button" variant="ghost" className="absolute right-3 top-2" onClick={() => { setExpanded(false); setZoomed(false); }}>Close</Button><img src={look?.shopperImageUrl} alt={look?.advice.headline} className={zoomed ? "h-auto w-[200%] max-w-none" : "mx-auto max-h-[calc(90dvh-4rem)] w-full object-contain"} /></div></div>}
     {message && <p role="alert" className="mx-5 rounded bg-destructive/5 p-3 text-sm text-destructive">{message}</p>}
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onSignedIn={() => { setLoading(true); void load(); }} />
  </ShopLookShell>;
}