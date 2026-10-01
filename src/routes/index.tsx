import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, ImagePlus, Instagram, Link as LinkIcon, LoaderCircle, MessageCircle, Share2, ShoppingBag, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShopLookShell } from "@/components/shoplook-shell";
import { supabase } from "@/integrations/supabase/client";
import { listCatalogProducts } from "@/lib/community.functions";
import type { CatalogProductDto } from "@/lib/community.types";
type Product = CatalogProductDto;
type PendingAction = { type: "favorite" | "share" | "buy"; productId: string };

export const Route = createFileRoute("/")({
  validateSearch: (search) => z.object({ product: z.string().optional(), mood: z.string().optional() }).catch({}).parse(search),
  head: () => ({ meta: [
    { title: "Shop your look — ShopLook" },
    { name: "description", content: "Upload your photo, explore apparel on your look, compare favorites, share and shop." },
    { property: "og:title", content: "Shop your look — ShopLook" },
    { property: "og:description", content: "Explore apparel on your photo, compare favorites, share and shop." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ShopLook,
});

function shopUrl(product: Product) {
  return product.productUrl;
}

function productBrand(name: string) {
  const brands = [
    "Symbol Premium", "SMOWKLY", "DEELMO", "INKAST", "AD by Arvind", "BASICS", "Thomas Scott",
    "FableStreet", "SaintX", "Cottinfab", "U.S. Polo ASSN.", "ROCKSY", "KLOSIA", "Stylum", "Myx",
    "Calvin Klein", "CK", "Louis Philippe", "USPA", "Levi's", "SHEIN", "Moomaya",
  ];
  const withoutRetailerPrefix = name.replace(/^Amazon Brand\s*[-–]\s*/i, "");
  return brands.find((brand) => withoutRetailerPrefix.toLowerCase().startsWith(brand.toLowerCase())) ?? "Brand not listed";
}

function PreviewPhoto({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="absolute inset-0 overflow-hidden bg-surface">
    {!loaded && !failed && <div className="absolute inset-0 grid place-items-center" role="status" aria-label="Loading image"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>}
    {failed ? <div className="flex size-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Image unavailable</div> : <img src={src} alt={alt} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`size-full object-contain ${loaded ? "" : "invisible"}`} />}
  </div>;
}

function LookImage({ person, product, generated, comparison = false, onOpen }: { person: string; product: Product; generated?: string | undefined; comparison?: boolean; onOpen: (src: string, alt: string) => void }) {
  const [generatedFailed, setGeneratedFailed] = useState(false);
  useEffect(() => setGeneratedFailed(false), [generated]);
  const showGenerated = Boolean(generated && !generatedFailed);
  const imageAlt = showGenerated ? `AI visualization of you wearing ${product.name}` : "Your original photo — no outfit has been generated yet";
  return <Button type="button" variant="ghost" aria-label={`Enlarge ${showGenerated ? product.name + " look" : "your original photo"}`} onClick={() => onOpen(showGenerated && generated ? generated : person, imageAlt)} className={`relative block w-full shrink-0 overflow-hidden rounded-none bg-surface p-0 hover:bg-surface focus-visible:ring-inset ${comparison ? "aspect-[2/3] h-auto" : "h-[50dvh] min-h-[320px] max-h-[540px]"}`}>
    {showGenerated && generated ? <img src={generated} alt={`AI visualization of you wearing ${product.name}`} onError={() => setGeneratedFailed(true)} className="absolute inset-0 size-full object-contain" /> : <PreviewPhoto key={person} src={person} alt="Your original photo — no outfit has been generated yet" />}
    {!showGenerated && <span className="absolute bottom-3 left-3 rounded bg-overlay px-2.5 py-1 text-[10px] font-semibold text-overlay-foreground">Your original photo</span>}
    {generatedFailed && <span role="alert" className="absolute right-3 top-3 rounded bg-overlay px-2 py-1 text-xs text-overlay-foreground">AI image unavailable · showing your photo</span>}
  </Button>;
}

function ShopLook() {
  const { product: selectedProductId } = Route.useSearch();
  const navigate = useNavigate();
  const loadCatalog = useServerFn(listCatalogProducts);
  const [products, setProducts] = useState<Product[]>([]);
  const [audience, setAudience] = useState<"men" | "women" | null>(null);
  const [catalogError, setCatalogError] = useState("");
  useEffect(() => { void loadCatalog().then(setProducts).catch(() => setCatalogError("Could not load products. Please reload to try again.")); }, [loadCatalog]);
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  useEffect(() => { if (selectedProduct) setAudience(selectedProduct.audience); }, [selectedProduct]);
  const visibleProducts = products.filter((product) => product.audience === audience).sort((left, right) => left.id === selectedProductId ? -1 : right.id === selectedProductId ? 1 : 0);
  const firstProduct = visibleProducts[0];
  const [view, setView] = useState<"start" | "try" | "compare">("start");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shareId, setShareId] = useState<string | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<{ src: string; alt: string } | null>(null);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const person = photo ?? "";
  const active = products.find((product) => product.id === activeId) ?? firstProduct;
  const shareProduct = products.find((product) => product.id === shareId);
  const comparison = favorites.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));

  useEffect(() => () => { if (photo?.startsWith("blob:")) URL.revokeObjectURL(photo); }, [photo]);

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
      setError("Choose a JPG, PNG or WebP photo under 8 MB."); event.target.value = ""; return;
    }
    void navigate({ to: "/", search: {}, replace: true });
    setEnlargedPhoto(null);
    setAudience(null);
    setError(""); setPhoto(URL.createObjectURL(file)); setPhotoFile(file); setGenerated({}); setGenerationError(""); setActiveId(""); setFavorites([]);
    event.target.value = "";
  }

  function chooseAudience(next: "men" | "women") {
    setAudience(next); setActiveId("");
  }

  function applyFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function requireSignIn(action: PendingAction) {
    const { data } = await supabase.auth.getUser();
    if (data.user) return true;
    setPendingAction(action);
    setAuthOpen(true);
    return false;
  }

  async function favoriteLook(product: Product) {
    if (!await requireSignIn({ type: "favorite", productId: product.id })) return;
    applyFavorite(product.id);
  }

  async function openShare(product: Product) {
    if (!await requireSignIn({ type: "share", productId: product.id })) return;
    setShareId(product.id);
  }

  async function openShop(product: Product) {
    if (!await requireSignIn({ type: "buy", productId: product.id })) return;
    window.open(shopUrl(product), "_blank", "noopener,noreferrer");
  }

  function selectProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product || generating) return;
    setGenerationError("");
    if (generated[id]) setActiveId(id);
    else void generateLook(product);
  }

  async function generateLook(product: Product) {
    if (generating || !photoFile) return;
    setGenerating(product.id); setGenerationError("");
    try {
      const garmentBlob = await (await fetch(product.image)).blob();
      const garment = new File([garmentBlob], `${product.id}.${garmentBlob.type === "image/webp" ? "webp" : "jpg"}`, { type: garmentBlob.type });
      const form = new FormData();
       form.append("person", photoFile); form.append("garment", garment); form.append("productName", product.name);
      const response = await fetch("/api/generate-look", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { image?: string; message?: string };
      if (!response.ok || !result.image) throw new Error(result.message ?? "OpenRouter could not make this look right now.");
      const nextImage = new Image();
      nextImage.src = result.image;
      await nextImage.decode();
      setGenerated((current) => ({ ...current, [product.id]: result.image as string }));
      setActiveId(product.id);
    } catch (reason) {
      setGenerationError(reason instanceof Error ? reason.message : "Could not make an AI look right now.");
    } finally { setGenerating(null); }
  }

  async function shareImage(product: Product) {
    try {
      const generatedImage = generated[product.id];
      if (!generatedImage) { setMessage("Generate this look before sharing it."); return; }
      const image = new File([await (await fetch(generatedImage)).blob()], `shoplook-${product.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [image] })) {
        await navigator.share({ files: [image], title: `My ShopLook — ${product.name}` });
      } else {
        const link = document.createElement("a");
        const url = URL.createObjectURL(image);
        link.href = url; link.download = image.name; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setMessage("Image downloaded. You can post it to Instagram or WhatsApp.");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setMessage("Could not share this image. Please try again.");
    }
  }

  function continuePendingAction() {
    const action = pendingAction;
    if (!action) return;
    const product = products.find((item) => item.id === action.productId);
    if (!product) { setPendingAction(null); return; }
    setPendingAction(null);
    if (action.type === "favorite") applyFavorite(product.id);
    if (action.type === "share") setShareId(product.id);
    if (action.type === "buy") window.open(shopUrl(product), "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage("Link copied. Your private photo is not included in this link."); }
    catch {
      const input = document.createElement("textarea");
      input.value = window.location.href;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      setMessage(copied ? "Link copied. Your private photo is not included in this link." : "Copying is unavailable in this browser.");
    }
  }

  function reset() { setAudience(null); setView("start"); setPhoto(null); setPhotoFile(null); setGenerated({}); setGenerationError(""); setFavorites([]); setActiveId(""); setShareId(null); setMessage(""); }

  return <ShopLookShell>
    <header className="flex h-16 items-center justify-between border-b border-border px-5">
      {view === "start" ? <span className="w-10" /> : <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => setView(view === "compare" ? "try" : "start")}><ArrowLeft /></Button>}
      <Button variant="ghost" onClick={reset} className="font-display text-2xl font-normal">ShopLook</Button>
      <span className="w-10" aria-hidden="true" />
    </header>

    {view === "start" && <section className="px-5 pb-12 pt-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">AI-Powered Shopping Agent</p>
      <h1 className="mt-3 font-display text-5xl leading-none">Shop your look.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Fashion shopping made personal and fun.</p>
      <div className="mt-6 overflow-hidden rounded-md bg-surface">
        <Button type="button" variant="ghost" className="relative aspect-[5/4] h-auto w-full rounded-none p-0" onClick={() => fileRef.current?.click()} aria-label={photo ? "Change your photo" : "Upload your photo"}>
          {photo ? <img src={photo} alt="Your photo preview" className="size-full object-contain" /> : <div className="flex size-full flex-col items-center justify-center gap-3 bg-surface"><span className="grid size-14 place-items-center rounded-full bg-background text-primary"><ImagePlus className="size-6" /></span><span className="font-display text-2xl">Add your photo</span><span className="text-xs text-muted-foreground">Choose a clear picture of yourself</span></div>}
          {photo && <span className="absolute bottom-3 right-3 rounded bg-overlay px-3 py-1.5 text-xs text-overlay-foreground"><Check className="mr-1 inline size-3" /> Photo ready · tap to change</span>}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose your photo" className="sr-only" onChange={upload} />
        <h2 className="mt-5 text-sm font-semibold">Choose one</h2>
        <div className="mt-2 flex gap-2" role="group" aria-label="Explore products"><Button type="button" aria-pressed={audience === "women"} variant={audience === "women" ? "default" : "outline"} onClick={() => chooseAudience("women")}>Woman</Button><Button type="button" aria-pressed={audience === "men"} variant={audience === "men" ? "default" : "outline"} onClick={() => chooseAudience("men")}>Man</Button>{audience && <span className="self-center text-xs text-muted-foreground">{visibleProducts.length} products</span>}</div>
      {catalogError && <p role="alert" className="mt-3 text-sm text-destructive">{catalogError}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        <Button className="mt-5 h-12 w-full text-base" disabled={!photo || !firstProduct} onClick={() => { if (!firstProduct) return; setView("try"); void generateLook(firstProduct); }}>Create your ShopLook <Sparkles /></Button>
    </section>}

     {view === "try" && active && <section className="min-w-0 overflow-x-clip pb-12">
          <div className="relative"><LookImage person={person} product={active} generated={generated[active.id]} onOpen={(src, alt) => setEnlargedPhoto({ src, alt })} />{generating && <div role="status" className="absolute inset-x-0 top-0 flex min-w-0 items-center gap-2 bg-overlay px-4 py-3 text-sm text-overlay-foreground"><LoaderCircle className="size-4 shrink-0 animate-spin" /><span className="min-w-0 truncate">Creating your {products.find((product) => product.id === generating)?.name ?? "next"} look…</span></div>}</div>
           <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pt-4"><div className="min-w-0"><h2 className="truncate font-display text-xl">{productBrand(active.name)}</h2><p className="truncate text-sm text-muted-foreground">{active.retailer} · ₹{active.price.toLocaleString("en-IN")}</p></div><Button variant="outline" size="icon" className="size-10 shrink-0" disabled={!generated[active.id]} aria-label={favorites.includes(active.id) ? `Remove ${active.name} from favorites` : `Favorite ${active.name}`} aria-pressed={favorites.includes(active.id)} onClick={() => void favoriteLook(active)}><Heart className={favorites.includes(active.id) ? "fill-primary text-primary" : ""} /></Button></div>
          {generationError && <div className="px-5 pt-3"><p role="alert" className="text-center text-xs text-destructive">{generationError} Tap the product again to retry.</p></div>}
           <div className="mt-3 grid grid-cols-2 gap-2 px-5"><Button variant="outline" className="h-10 px-2" disabled={!generated[active.id]} onClick={() => void openShare(active)}><Share2 /> Share</Button><Button className="h-10 px-2" onClick={() => void openShop(active)}><ShoppingBag /> {active.productUrl ? "Buy" : "Search"}</Button></div>
       <div className="mt-5 flex items-center justify-between px-5"><h2 className="font-display text-xl">Create more looks</h2><span className="text-xs text-muted-foreground">Swipe to explore →</span></div>
           <div className="mt-2 flex max-w-full snap-x gap-2 overflow-x-auto px-5 pb-3 scrollbar-thin">{visibleProducts.map((product) => <Button key={product.id} variant="ghost" disabled={Boolean(generating)} aria-label={`Try ${product.name} on me`} aria-pressed={activeId === product.id} onClick={() => selectProduct(product.id)} className={`h-auto w-24 shrink-0 snap-start flex-col items-stretch gap-0 overflow-hidden rounded-md border p-0 text-left ${activeId === product.id || generating === product.id ? "border-primary" : "border-border"}`}><span className="aspect-[4/5] w-full bg-surface"><img src={product.image} alt="" loading="lazy" width={768} height={1024} className="size-full object-contain" /></span><span className="block w-full truncate px-2 pt-2 text-xs font-medium">{productBrand(product.name)}</span><span className="block w-full truncate px-2 text-[11px] text-muted-foreground">{product.retailer}</span><span className="w-full px-2 pb-2 text-xs">₹{product.price.toLocaleString("en-IN")}</span></Button>)}</div>
       <p className="mt-2 px-5 text-center text-[11px] text-muted-foreground">Buy opens the product at {active.retailer}. Price and availability may change.</p>
         <div className="mx-5 mt-7 border-t border-border pt-5"><Button className="h-12 w-full" disabled={favorites.length === 0} onClick={() => setView("compare")}>Compare my looks ({favorites.length}) <ArrowRight /></Button><p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">{favorites.length === 0 ? "Generate a virtual look, then heart it to compare. " : ""}Only generated looks appear in your comparison.</p></div>
    </section>}

    {view === "compare" && <section className="px-4 pb-12 pt-6"><p className="px-1 text-xs font-semibold uppercase tracking-widest text-primary">The shortlist</p>
         <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-7">{comparison.map((product) => <article key={product.id} className="min-w-0"><LookImage person={person} product={product} generated={generated[product.id]} comparison onOpen={(src, alt) => setEnlargedPhoto({ src, alt })} /><div className="flex min-h-14 items-center justify-between gap-1 py-2"><div className="min-w-0"><h2 className="truncate font-display text-lg">{productBrand(product.name)}</h2><p className="truncate text-xs text-muted-foreground">{product.retailer} · ₹{product.price.toLocaleString("en-IN")}</p></div><Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Remove ${product.name} from comparison`} onClick={() => void favoriteLook(product)}><Heart className="fill-primary text-primary" /></Button></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="size-10" aria-label={`Share ${product.name}`} title="Share" onClick={() => void openShare(product)}><Share2 /></Button><Button size="icon" className="size-10" aria-label={`${product.productUrl ? "Buy" : "Search for"} ${product.name}`} title={product.productUrl ? "Buy" : "Search"} onClick={() => void openShop(product)}><ShoppingBag /></Button></div></article>)}</div>
        {comparison.length === 0 && <div className="py-16 text-center"><Heart className="mx-auto mb-3 size-7 text-primary" /><p className="text-sm text-muted-foreground">Your shortlist is empty. Generate a look and heart it to compare here.</p></div>}
         <Button variant="outline" className="mt-8 h-11 w-full" onClick={() => setView("try")}>Try more apparel</Button><p className="mt-4 text-center text-[11px] text-muted-foreground">AI visualizations are not fit guarantees · retailer links are for discovery · no partnership implied</p>
    </section>}

    <Dialog open={Boolean(enlargedPhoto)} onOpenChange={(open) => { if (!open) { setEnlargedPhoto(null); setPhotoZoom(false); } }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl gap-0 rounded-md border-border p-3 pt-12 sm:p-4 sm:pt-12">
        <DialogTitle className="sr-only">{enlargedPhoto?.alt ?? "Photo"}</DialogTitle>
        {enlargedPhoto && <><Button type="button" variant="outline" size="icon" className="absolute left-3 top-2 size-9" aria-label={photoZoom ? "Zoom out" : "Zoom in"} onClick={() => setPhotoZoom((current) => !current)}>{photoZoom ? <ZoomOut /> : <ZoomIn />}</Button><div className="max-h-[calc(100dvh-6rem)] overflow-auto"><img src={enlargedPhoto.src} alt={enlargedPhoto.alt} className={photoZoom ? "h-auto w-[200%] max-w-none" : "mx-auto max-h-[calc(100dvh-6rem)] w-full object-contain"} /></div></>}
      </DialogContent>
    </Dialog>
    {shareProduct && <div role="dialog" aria-modal="true" aria-label={`Share ${shareProduct.name}`} className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareId(null); }}><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Share your look</h2><Button variant="ghost" size="icon" aria-label="Close share options" onClick={() => setShareId(null)}><X /></Button></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Share your look with friends on Insta and WhatsApp for feedback &amp; fun :)</p><div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={() => void shareImage(shareProduct)}><Instagram /> Instagram</Button><Button variant="outline" className="h-12" onClick={() => void shareImage(shareProduct)}><MessageCircle /> WhatsApp</Button></div><Button variant="outline" className="mt-2 h-12 w-full" onClick={() => void copyLink()}><LinkIcon /> Copy app link</Button>{message && <p role="status" className="mt-3 text-xs text-primary">{message}</p>}</div></div>}
    {message && !shareProduct && <p role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-sm rounded-md bg-overlay px-4 py-3 text-center text-sm text-overlay-foreground shadow-float">{message}</p>}
    <AuthDialog open={authOpen} onOpenChange={(open) => { setAuthOpen(open); if (!open) setPendingAction(null); }} onSignedIn={continuePendingAction} />
  </ShopLookShell>;
}
