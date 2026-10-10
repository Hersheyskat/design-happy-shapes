import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Check, Heart, ImagePlus, LoaderCircle, LockKeyhole, Maximize2, Plus, Shirt, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { ShopLookShell } from "@/components/shoplook-shell";
import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { addWardrobeItems, listWardrobe, removeWardrobeItem, suggestWardrobe } from "@/lib/wardrobe.functions";
import { listCatalogProducts, saveMyLook } from "@/lib/community.functions";
import { analyseGeneratedLook } from "@/lib/stylist-comment.functions";
import { streamImage } from "@/lib/wardrobe-stream-image";
import { wardrobeCategories, type WardrobeItem, type WardrobeOutfit } from "@/lib/wardrobe.types";
import type { CatalogProductDto } from "@/lib/community.types";

export const Route = createFileRoute("/wardrobe")({ head: () => ({ meta: [
  { title: "What should I wear? — ShopLook Wardrobe" },
  { name: "description", content: "Build a private wardrobe, discover occasion-ready outfit combinations and shop only the missing pieces with ShopLook." },
  { property: "og:title", content: "Your wardrobe, new possibilities — ShopLook" },
  { property: "og:description", content: "Mix your own clothes into thoughtfully styled looks for everyday life and every occasion." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
] }), component: WardrobePage });

type Draft = { file: File; preview: string; name: string; category: typeof wardrobeCategories[number] };
const occasions = ["Everyday", "Work", "Dinner", "Wedding", "Party", "Weekend"];

function WardrobePage() {
  const getWardrobe = useServerFn(listWardrobe);
  const addItems = useServerFn(addWardrobeItems);
  const removeItem = useServerFn(removeWardrobeItem);
  const suggest = useServerFn(suggestWardrobe);
  const getCatalog = useServerFn(listCatalogProducts);
  const saveLook = useServerFn(saveMyLook);
  const getComment = useServerFn(analyseGeneratedLook);
  const [userId, setUserId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filter, setFilter] = useState("All");
  const [occasion, setOccasion] = useState("Everyday");
  const [customOccasion, setCustomOccasion] = useState("");
  const [preferences, setPreferences] = useState("");
  const [outfits, setOutfits] = useState<WardrobeOutfit[]>([]);
  const [active, setActive] = useState<WardrobeOutfit | null>(null);
  const [avatar, setAvatar] = useState<{ file: File; url: string } | null>(null);
  const [result, setResult] = useState<{ image: string; outfit: WardrobeOutfit; productId: string | null; comment: string; saved: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const realOccasion = customOccasion.trim() || occasion;

  const reload = async () => {
    const rows = await getWardrobe();
    const urls = await supabase.storage.from("shoplook-media").createSignedUrls(rows.map((row) => row.image_path), 3600);
    const signed = new Map(urls.data?.map((entry) => [entry.path, entry.signedUrl]) ?? []);
    setItems(rows.map((row) => ({ ...row, imageUrl: signed.get(row.image_path) })));
    setSelected((current) => current.filter((id) => rows.some((row) => row.id === id)));
  };
  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => { if (alive) { setUserId(data.user?.id ?? null); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" || event === "SIGNED_OUT") setUserId(session?.user.id ?? null); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!userId) { setItems([]); setSelected([]); setOutfits([]); setResult(null); return; }
    setLoading(true);
    void reload().catch((e) => setError(e.message)).finally(() => setLoading(false));
    // Reload private wardrobe only when account identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  useEffect(() => { void getCatalog().then(setCatalog).catch(() => setError("Shopping suggestions are temporarily unavailable.")); }, [getCatalog]);
  const requireSignIn = async (action: () => void) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) { setUserId(data.user.id); action(); }
    else { pending.current = action; setAuthOpen(true); }
  };
  const run = async (label: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Please try again."); } finally { setBusy(""); }
  };
  const clearDrafts = () => { drafts.forEach((draft) => URL.revokeObjectURL(draft.preview)); setDrafts([]); };
  const upload = async () => run("upload", async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Please sign in again.");
    const paths: string[] = [];
    try {
      const rows = [];
      for (const draft of drafts) {
        const path = `${data.user.id}/wardrobe/${crypto.randomUUID()}`;
        const saved = await supabase.storage.from("shoplook-media").upload(path, draft.file, { contentType: draft.file.type });
        if (saved.error) throw new Error("Could not upload your clothing photo.");
        paths.push(path); rows.push({ name: draft.name, category: draft.category, imagePath: path });
      }
      await addItems({ data: rows });
    } catch (e) { if (paths.length) await supabase.storage.from("shoplook-media").remove(paths); throw e; }
    clearDrafts(); setOutfits([]); await reload();
  });
  const generate = (outfit: WardrobeOutfit, productId: string | null = null) => {
    setActive(outfit);
    if (!avatar) { avatarRef.current?.click(); return; }
    void requireSignIn(() => void run("generate", async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again.");
      const form = new FormData(); form.append("person", avatar.file); form.append("outfit", JSON.stringify({ ids: outfit.wardrobeIds, productId, occasion: realOccasion, styling: outfit.styling }));
      let completed = "";
      await streamImage("/api/wardrobe-look", form, (image, final) => { if (final) completed = image; }, undefined, { Authorization: `Bearer ${data.session.access_token}` });
      if (!completed) throw new Error("No completed outfit photo was returned.");
      setResult({ image: completed, outfit, productId, comment: "", saved: false });
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      void getComment({ data: { lookImage: completed, productName: outfit.title, retailer: "Your wardrobe" } }).then((reply) => { if (reply.ok) setResult((current) => current?.image === completed ? { ...current, comment: reply.comment } : current); }).catch(() => {});
    }));
  };
  const heart = () => { if (!result || result.saved) return; void requireSignIn(() => void run("save", async () => {
    const { data } = await supabase.auth.getUser(); if (!data.user) throw new Error("Please sign in again.");
    const path = `${data.user.id}/looks/${crypto.randomUUID()}`;
    const image = await fetch(result.image).then((response) => response.blob());
    const stored = await supabase.storage.from("shoplook-media").upload(path, image, { contentType: image.type });
    if (stored.error) throw new Error("Could not save this look.");
    try { await saveLook({ data: { shopperImagePath: path, productImagePath: null, productUrl: null, ...(result.productId ? { catalogProductId: result.productId } : {}), styleNote: `${realOccasion}: ${result.outfit.title}`.slice(0, 280), mood: "classic", stylistComment: (result.comment || result.outfit.reason).slice(0, 240) } }); } catch (e) { await supabase.storage.from("shoplook-media").remove([path]); throw e; }
    setResult((current) => current?.image === result.image ? { ...current, saved: true } : current);
  })); };

  return <ShopLookShell>
    <header className="flex items-center justify-between border-b border-border px-5 py-4"><span className="font-display text-2xl">ShopLook</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3" />Private wardrobe</span></header>
    <section className="px-5 pt-6 pb-5"><p className="text-xs font-semibold uppercase text-primary">Your wardrobe</p><h1 className="mt-1 font-display text-4xl leading-tight">What should I wear?</h1>
      <div className="mt-5 flex items-center gap-3"><div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface">{avatar ? <img src={avatar.url} alt="Your avatar photo" className="size-full object-cover" /> : <Shirt className="size-6 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{avatar ? "Your avatar" : "Your next outfit starts here"}</p><Button variant="link" className="h-7 px-0 text-xs" onClick={() => avatarRef.current?.click()}><ImagePlus />{avatar ? "Change your photo" : "Add your photo"}</Button></div></div>
    </section>
    <section className="border-y border-border px-5 py-5"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">My clothes <span className="text-sm font-normal text-muted-foreground">{items.length}</span></h2><Button size="sm" disabled={!!busy} onClick={() => void requireSignIn(() => filesRef.current?.click())}><Plus />Add clothes</Button></div>
      {loading ? <div className="py-10 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></div> : !items.length ? <div className="mt-4 border border-dashed border-border py-8 text-center"><Shirt className="mx-auto size-8 text-primary" /><p className="mt-3 text-sm font-medium">{userId ? "A fresh start for your wardrobe" : "Your clothes. Your private space."}</p><Button variant="link" className="mt-1 text-xs" onClick={() => void requireSignIn(() => filesRef.current?.click())}>{userId ? "Add your first clothing photos" : "Sign in & add your clothes"}</Button></div> : <>
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-2">{["All", ...wardrobeCategories].map((category) => <Button key={category} size="sm" variant={filter === category ? "secondary" : "ghost"} onClick={() => setFilter(category)}>{category}</Button>)}</div>
        <div className="mt-2 grid grid-cols-3 gap-2.5">{items.filter((item) => filter === "All" || item.category === filter).map((item) => <div key={item.id} className="min-w-0"><div className="relative"><Button variant="ghost" aria-label={`Select ${item.name}`} aria-pressed={selected.includes(item.id)} className={`h-auto w-full overflow-hidden rounded-md p-0 ${selected.includes(item.id) ? "ring-2 ring-primary" : ""}`} disabled={!!busy} onClick={() => { setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : current.length < 12 ? [...current, item.id] : current); setOutfits([]); }}><img src={item.imageUrl} alt={item.name} className="aspect-[3/4] w-full object-contain bg-surface" />{selected.includes(item.id) && <span className="absolute left-1 top-1 rounded-full bg-primary p-1 text-primary-foreground"><Check className="size-3" /></span>}</Button><Button variant="secondary" size="icon-xs" className="absolute right-1 top-1" aria-label={`Remove ${item.name}`} disabled={!!busy} onClick={() => { if (window.confirm(`Remove ${item.name} from your wardrobe?`)) void run("remove", async () => { await removeItem({ data: { id: item.id } }); setOutfits([]); await reload(); }); }}><Trash2 /></Button></div><p className="mt-1.5 truncate text-xs font-medium" title={item.name}>{item.name}</p><span className="text-[10px] text-muted-foreground">{item.category}</span></div>)}</div>
        <p className="mt-3 text-xs text-muted-foreground">{selected.length ? `${selected.length} pieces selected` : "All clothes included"} · up to 12 per outfit session</p>
      </>}
    </section>
    <section className="px-5 py-5"><h2 className="text-lg font-semibold">What's the occasion?</h2><div className="mt-3 grid grid-cols-3 gap-2">{occasions.map((option) => <Button key={option} size="sm" variant={occasion === option && !customOccasion ? "default" : "outline"} onClick={() => { setOccasion(option); setCustomOccasion(""); setOutfits([]); }}>{option}</Button>)}</div><Input className="mt-3" aria-label="Other occasion" placeholder="Another occasion? e.g. a beach wedding" maxLength={160} value={customOccasion} onChange={(e) => { setCustomOccasion(e.target.value); setOutfits([]); }} /><Input className="mt-2" aria-label="Outfit preferences" placeholder="Any preferences? Colours, weather, budget…" maxLength={280} value={preferences} onChange={(e) => setPreferences(e.target.value)} />
      <Button className="mt-4 h-11 w-full" disabled={!!busy || (userId !== null && !items.length)} onClick={() => void requireSignIn(() => void run("suggest", async () => { const ids = selected.length ? selected : items.slice(0, 12).map((item) => item.id); if (!ids.length) { filesRef.current?.click(); return; } setOutfits(await suggest({ data: { ids, occasion: realOccasion, preferences } })); }))}>{busy === "suggest" ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{busy === "suggest" ? "Styling your wardrobe…" : "Find my outfits"}</Button>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
    {outfits.length > 0 && <section className="border-t border-border px-5 py-5"><div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold">Your outfit ideas</h2><span className="text-xs text-muted-foreground">{realOccasion}</span></div><div className="mt-4 space-y-4">{outfits.map((outfit, index) => <article key={`${index}-${outfit.title}`} className="rounded-lg border border-border p-3.5"><span className="text-[10px] font-semibold uppercase text-primary">Look {index + 1}</span><h3 className="mt-1 text-base font-semibold">{outfit.title}</h3><div className="mt-3 flex gap-2 overflow-x-auto">{outfit.wardrobeIds.map((id) => { const item = items.find((entry) => entry.id === id); return item ? <img key={id} src={item.imageUrl} alt={item.name} title={item.name} className="h-24 w-20 shrink-0 rounded bg-surface object-contain" /> : null; })}</div><p className="mt-3 text-sm">{outfit.reason}</p><p className="mt-2 text-xs text-muted-foreground">{outfit.styling}</p><Button className="mt-3 w-full" disabled={!!busy} onClick={() => generate(outfit)}><Sparkles />{busy === "generate" && active === outfit ? "Creating Your ShopLook…" : "Create this look"}</Button>
      {outfit.missing.length > 0 && <div className="mt-4 border-t border-border pt-3"><p className="text-xs font-semibold">The missing finishing touch</p>{outfit.missing.map((piece, i) => { const product = catalog.find((entry) => entry.id === piece.catalogProductId); return <div key={i} className="mt-3"><p className="text-sm font-medium">{piece.label}</p><p className="mt-1 text-xs text-muted-foreground">{piece.reason}</p>{product ? <div className="mt-2 flex gap-3"><img src={product.image} alt={product.name} className="h-24 w-16 shrink-0 rounded bg-surface object-contain" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-medium">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{product.retailer} · {new Intl.NumberFormat("en-IN", { style: "currency", currency: product.currency, maximumFractionDigits: 0 }).format(product.price)}</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!!busy} onClick={() => generate(outfit, product.id)}><Sparkles />Style with it</Button><Button size="sm" onClick={() => void requireSignIn(() => { window.location.assign(product.productUrl); })}><ShoppingBag />Buy</Button></div></div></div> : <Button variant="link" className="mt-1 h-auto whitespace-normal px-0 text-left text-xs" onClick={() => void requireSignIn(() => { window.location.assign(`https://www.google.com/search?tbm=shop&gl=in&q=${encodeURIComponent(piece.searchTerm)}`); })}><ShoppingBag />Find this piece</Button>}</div>; })}</div>}
      </article>)}</div></section>}
    <section ref={resultRef} className="scroll-mt-3">{(result || busy === "generate") && <div className="border-t border-border px-5 py-5"><h2 className="mb-3 text-lg font-semibold">{busy === "generate" ? "Creating Your ShopLook…" : result?.outfit.title}</h2><div className="relative h-[clamp(260px,48dvh,600px)] overflow-hidden rounded-lg bg-surface"><img src={result?.image || avatar?.url} alt={result ? "Your styled wardrobe outfit" : "Your original photo"} className="size-full object-contain" />{busy === "generate" && <div className="absolute inset-0 grid place-items-center bg-scrim"><span className="flex items-center gap-2 rounded bg-overlay px-3 py-2 text-sm text-overlay-foreground"><LoaderCircle className="size-4 animate-spin" />Creating Your ShopLook…</span></div>}{result && <Button size="icon-sm" variant="secondary" className="absolute right-2 top-2" aria-label="Expand wardrobe look" onClick={() => setExpanded(true)}><Maximize2 /></Button>}</div>{result && <><div className="mt-3 flex items-center justify-between"><p className="text-xs text-muted-foreground">From your wardrobe · {realOccasion}</p><Button size="icon" variant={result.saved ? "default" : "outline"} aria-label={result.saved ? "Look saved privately" : "Save wardrobe look"} aria-pressed={result.saved} disabled={!!busy} onClick={heart}>{busy === "save" ? <LoaderCircle className="animate-spin" /> : <Heart className={result.saved ? "fill-current" : ""} />}</Button></div>{result.comment && <p className="mt-3 text-sm"><Sparkles className="mr-1 inline size-4 text-primary" />{result.comment}</p>}</>}</div>}</section>
    <input ref={filesRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Upload wardrobe clothing" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length > 10 || files.some((file) => file.size > 5_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Choose up to 10 JPG, PNG or WebP photos, each under 5 MB."); return; } setDrafts(files.map((file) => ({ file, preview: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, "").slice(0, 100), category: "Other" }))); }} />
    <input ref={avatarRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload wardrobe avatar" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG or WebP photo under 8 MB."); return; } if (avatar) URL.revokeObjectURL(avatar.url); setAvatar({ file, url: URL.createObjectURL(file) }); }} />
    <Dialog open={drafts.length > 0} onOpenChange={(open) => { if (!open && busy !== "upload") clearDrafts(); }}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto"><DialogHeader><DialogTitle>Add to your wardrobe</DialogTitle><DialogDescription>Clothing photos are kept privately in your account.</DialogDescription></DialogHeader><div className="space-y-4">{drafts.map((draft, index) => <div key={draft.preview} className="flex gap-3"><img src={draft.preview} alt="Clothing upload preview" className="h-24 w-20 rounded bg-surface object-contain" /><div className="min-w-0 flex-1 space-y-2"><Input aria-label={`Clothing name ${index + 1}`} value={draft.name} maxLength={100} onChange={(event) => setDrafts((current) => current.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} /><select aria-label={`Clothing category ${index + 1}`} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={draft.category} onChange={(event) => setDrafts((current) => current.map((entry, i) => i === index ? { ...entry, category: event.target.value as Draft["category"] } : entry))}>{wardrobeCategories.map((category) => <option key={category}>{category}</option>)}</select></div></div>)}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={!!busy || drafts.some((draft) => !draft.name.trim())} onClick={() => void requireSignIn(() => void upload())}>{busy === "upload" ? <LoaderCircle className="animate-spin" /> : <Plus />}{busy === "upload" ? "Adding clothes…" : "Add to my wardrobe"}</Button></DialogContent></Dialog>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="h-[90dvh] w-[calc(100%-1rem)] max-w-[430px] border-0 bg-background p-2"><DialogHeader className="sr-only"><DialogTitle>Your wardrobe look</DialogTitle><DialogDescription>Expanded styled outfit photo.</DialogDescription></DialogHeader><img src={result?.image} alt="Your wardrobe look expanded" className="size-full object-contain" /></DialogContent></Dialog>
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onSignedIn={() => { const action = pending.current; pending.current = null; action?.(); }} />
  </ShopLookShell>;
}