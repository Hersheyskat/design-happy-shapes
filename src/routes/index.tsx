import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, ImagePlus, Instagram, Link as LinkIcon, MessageCircle, RotateCcw, Share2, ShoppingBag, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShopLookShell } from "@/components/shoplook-shell";
import samplePerson from "@/assets/shoplook-coral.jpg";
import coralJacket from "@/assets/demo-coral-jacket.png";
import blackJacket from "@/assets/demo-black-jacket.png";
import ivoryShirt from "@/assets/demo-ivory-shirt.png";
import sageTop from "@/assets/demo-sage-top.png";
import denimJacket from "@/assets/demo-blue-denim.png";
import stripedShirt from "@/assets/demo-striped-shirt.png";

type Product = { id: string; name: string; category: string; image: string; search: string };
const products: Product[] = [
  { id: "coral", name: "Coral blazer", category: "The statement", image: coralJacket, search: "coral cropped blazer women" },
  { id: "black", name: "Tailored blazer", category: "Everyday sharp", image: blackJacket, search: "black oversized blazer women" },
  { id: "ivory", name: "Linen shirt", category: "Easy layers", image: ivoryShirt, search: "ivory linen shirt women" },
  { id: "sage", name: "Sage knit", category: "Soft color", image: sageTop, search: "sage green knit top women" },
  { id: "denim", name: "Denim jacket", category: "Off-duty", image: denimJacket, search: "cropped denim jacket women" },
  { id: "stripe", name: "Striped shirt", category: "A classic", image: stripedShirt, search: "blue striped shirt women" },
];
const firstProduct: Product = { id: "coral", name: "Coral blazer", category: "The statement", image: coralJacket, search: "coral cropped blazer women" };

export const Route = createFileRoute("/")({
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
  return `https://www.google.com/search?tbm=shop&gl=in&q=${encodeURIComponent(product.search)}`;
}

function LookImage({ person, product, label }: { person: string; product: Product; label?: string }) {
  return <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface">
    <img src={person} alt="Your uploaded photo" className="absolute inset-0 size-full object-cover" />
    <img src={product.image} alt={`${product.name} preview layer`} className="absolute left-[25%] top-[16%] h-[40%] w-[51%] object-fill drop-shadow-md" />
    {label && <span className="absolute bottom-3 left-3 rounded bg-overlay px-2.5 py-1 text-[10px] font-semibold uppercase text-overlay-foreground">{label}</span>}
  </div>;
}

async function makeLookImage(person: string, product: Product): Promise<File> {
  const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
  });
  const [photo, garment] = await Promise.all([load(person), load(product.image)]);
  const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 1200;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to prepare this image.");
  const scale = Math.max(canvas.width / photo.width, canvas.height / photo.height);
  context.drawImage(photo, (canvas.width - photo.width * scale) / 2, (canvas.height - photo.height * scale) / 2, photo.width * scale, photo.height * scale);
  context.drawImage(garment, 200, 192, 408, 480);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Unable to prepare this image.");
  return new File([blob], `shoplook-${product.id}.png`, { type: "image/png" });
}

function ShopLook() {
  const [view, setView] = useState<"start" | "try" | "compare">("start");
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState(firstProduct.id);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shareId, setShareId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const person = photo ?? samplePerson;
  const active = products.find((product) => product.id === activeId) ?? firstProduct;
  const shareProduct = products.find((product) => product.id === shareId);
  const comparison = favorites.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product));

  useEffect(() => () => { if (photo?.startsWith("blob:")) URL.revokeObjectURL(photo); }, [photo]);

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12_000_000) {
      setError("Choose a JPG, PNG or WebP photo under 12 MB."); return;
    }
    setError(""); setPhoto(URL.createObjectURL(file));
    event.target.value = "";
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function shareImage(product: Product) {
    try {
      const image = await makeLookImage(person, product);
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

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage("Link copied. Your private photo is not included in this link."); }
    catch { setMessage("Copying is unavailable in this browser."); }
  }

  function reset() { setView("start"); setPhoto(null); setNote(""); setFavorites([]); setActiveId(firstProduct.id); setShareId(null); setMessage(""); }

  return <ShopLookShell>
    <header className="flex h-16 items-center justify-between border-b border-border px-5">
      {view === "start" ? <span className="w-10" /> : <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => setView(view === "compare" ? "try" : "start")}><ArrowLeft /></Button>}
      <Button variant="ghost" onClick={reset} className="font-display text-2xl font-normal">ShopLook</Button>
      {view === "start" ? <span className="w-10" /> : <Button variant="ghost" size="icon" aria-label="Start over" onClick={reset}><RotateCcw /></Button>}
    </header>

    {view === "start" && <section className="px-5 pb-12 pt-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">A new way to get dressed</p>
      <h1 className="mt-3 font-display text-5xl leading-none">Shop your look.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Fashion shopping made personal and fun.</p>
      <div className="mt-7 overflow-hidden rounded-md bg-surface">
        <Button type="button" variant="ghost" className="relative aspect-[4/4.3] h-auto w-full rounded-none p-0" onClick={() => fileRef.current?.click()} aria-label="Upload your photo">
          {photo ? <img src={photo} alt="Your photo preview" className="size-full object-cover" /> : <div className="flex size-full flex-col items-center justify-center gap-4 bg-surface"><span className="grid size-16 place-items-center rounded-full bg-background text-primary"><ImagePlus className="size-7" /></span><span className="font-display text-2xl">Add your photo</span><span className="text-xs text-muted-foreground">Tap to choose a clear, full-body picture</span></div>}
          {photo && <span className="absolute bottom-3 right-3 rounded bg-overlay px-3 py-1.5 text-xs text-overlay-foreground"><Check className="mr-1 inline size-3" /> Photo ready</span>}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose your photo" className="sr-only" onChange={upload} />
      {photo && <Button variant="link" className="mt-1 px-0" onClick={() => fileRef.current?.click()}><Upload /> Change photo</Button>}
      <label htmlFor="style-note" className="mt-5 block text-sm font-semibold">What kind of look are you after? <span className="font-normal text-muted-foreground">Optional</span></label>
      <div className="mt-2 flex items-start gap-3 rounded-md border border-input bg-background px-3 py-3 focus-within:ring-1 focus-within:ring-ring">
        <MessageCircle className="mt-1 size-4 shrink-0 text-primary" />
        <textarea id="style-note" value={note} maxLength={280} rows={2} onChange={(event) => setNote(event.target.value)} placeholder="Something for brunch, an easy work look…" className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <Button className="mt-5 h-12 w-full text-base" disabled={!photo} onClick={() => setView("try")}>Explore looks <ArrowRight /></Button>
      <Button variant="ghost" className="mt-2 h-11 w-full text-xs text-muted-foreground" onClick={() => { setPhoto(null); setView("try"); }}>Explore with a sample photo</Button>
      <p className="mt-4 text-center text-[11px] leading-4 text-muted-foreground">Your photo stays on this device in this demo.</p>
    </section>}

    {view === "try" && <section className="pb-12">
      <div className="px-5 pb-4 pt-6"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Your style studio</p><h1 className="mt-1 font-display text-4xl">Try a new look</h1>{note && <p className="mt-2 border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">“{note}”</p>}</div>
      <LookImage person={person} product={active} label="Illustrative preview" />
      <div className="flex items-center justify-between gap-3 px-5 pt-4"><div className="min-w-0"><h2 className="font-display text-2xl">{active.name}</h2><p className="text-xs text-muted-foreground">{active.category} · approximate overlay</p></div><Button variant="outline" size="icon" className="size-11 shrink-0" aria-label={favorites.includes(active.id) ? `Remove ${active.name} from favorites` : `Favorite ${active.name}`} aria-pressed={favorites.includes(active.id)} onClick={() => toggleFavorite(active.id)}><Heart className={favorites.includes(active.id) ? "fill-primary text-primary" : ""} /></Button></div>
      <div className="mt-6 flex items-center justify-between px-5"><h2 className="font-display text-2xl">Try another piece</h2><span className="text-xs text-muted-foreground">Swipe to explore →</span></div>
      <div className="mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-3 scrollbar-thin">{products.map((product) => <Button key={product.id} variant="ghost" aria-label={`Try ${product.name}`} aria-pressed={activeId === product.id} onClick={() => setActiveId(product.id)} className={`h-auto w-32 shrink-0 snap-start flex-col items-stretch gap-0 overflow-hidden rounded-md border p-0 text-left ${activeId === product.id ? "border-primary" : "border-border"}`}><span className="aspect-[4/5] w-full bg-surface"><img src={product.image} alt="" loading="lazy" width={768} height={1024} className="size-full object-contain" /></span><span className="block w-full truncate px-2 py-2 text-xs font-medium">{product.name}</span></Button>)}</div>
      <div className="mt-5 grid grid-cols-2 gap-2 px-5"><Button variant="outline" className="h-11" onClick={() => setShareId(active.id)}><Share2 /> Share</Button><Button asChild className="h-11"><a href={shopUrl(active)} target="_blank" rel="noopener noreferrer"><ShoppingBag /> Buy</a></Button></div>
      <p className="mt-2 px-5 text-center text-[11px] text-muted-foreground">Buy opens an India retailer search; prices and stock are set by stores.</p>
      <div className="mx-5 mt-7 border-t border-border pt-5"><Button className="h-12 w-full" disabled={favorites.length === 0} onClick={() => setView("compare")}>Compare favorites ({favorites.length}) <ArrowRight /></Button><p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">This preview places an apparel image over your photo. It is not a realistic virtual try-on.</p></div>
    </section>}

    {view === "compare" && <section className="px-4 pb-12 pt-6"><p className="px-1 text-xs font-semibold uppercase tracking-widest text-primary">The shortlist</p><h1 className="mt-1 px-1 font-display text-4xl">Compare your looks</h1><p className="mt-2 px-1 text-sm text-muted-foreground">{comparison.length} favorites · scroll for more</p>
      <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-7">{comparison.map((product) => <article key={product.id} className="min-w-0"><LookImage person={person} product={product} label="Preview" /><div className="flex min-h-12 items-center justify-between gap-1 py-2"><h2 className="min-w-0 truncate font-display text-lg">{product.name}</h2><Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Remove ${product.name} from comparison`} onClick={() => toggleFavorite(product.id)}><Heart className="fill-primary text-primary" /></Button></div><div className="grid grid-cols-2 gap-1"><Button variant="outline" className="h-9 px-1 text-xs" onClick={() => setShareId(product.id)}><Share2 /> Share</Button><Button asChild className="h-9 px-1 text-xs"><a href={shopUrl(product)} target="_blank" rel="noopener noreferrer"><ShoppingBag /> Buy</a></Button></div></article>)}</div>
      {comparison.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No favorites yet. Go back and tap a heart on a look.</p>}
      <Button variant="outline" className="mt-8 h-11 w-full" onClick={() => setView("try")}>Try more apparel</Button><p className="mt-4 text-center text-[11px] text-muted-foreground">Illustrative overlays only · Buy opens retailer search results</p>
    </section>}

    {shareProduct && <div role="dialog" aria-modal="true" aria-label={`Share ${shareProduct.name}`} className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareId(null); }}><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Share this look</h2><Button variant="ghost" size="icon" aria-label="Close share options" onClick={() => setShareId(null)}><X /></Button></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Share the preview image using your phone’s share menu, or download it to post yourself.</p><div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={() => void shareImage(shareProduct)}><Instagram /> Instagram</Button><Button variant="outline" className="h-12" onClick={() => void shareImage(shareProduct)}><MessageCircle /> WhatsApp</Button></div><Button variant="outline" className="mt-2 h-12 w-full" onClick={() => void copyLink()}><LinkIcon /> Copy app link</Button><p className="mt-3 text-[11px] leading-4 text-muted-foreground">The copied link opens ShopLook, not your private photo. Instagram and WhatsApp need their apps or your device’s share menu.</p>{message && <p role="status" className="mt-3 text-xs text-primary">{message}</p>}</div></div>}
  </ShopLookShell>;
}
