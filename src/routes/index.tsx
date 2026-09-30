import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, ImagePlus, Instagram, Link as LinkIcon, LoaderCircle, MessageCircle, RotateCcw, Share2, ShoppingBag, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShopLookShell } from "@/components/shoplook-shell";
import samplePerson from "@/assets/shoplook-coral.jpg";
import blackBlazer from "@/assets/black-blazer.jpg.asset.json";
import oliveCoord from "@/assets/olive-coord.webp.asset.json";
import tealPolo from "@/assets/teal-polo.jpg.asset.json";
import pinkBlazer from "@/assets/pink-blazer.jpg.asset.json";

type Product = { id: string; name: string; category: string; image: string; search: string };
const products: Product[] = [
  { id: "black", name: "Black blazer", category: "Tailored", image: blackBlazer.url, search: "women black tailored blazer" },
  { id: "olive", name: "Olive co-ord", category: "Relaxed set", image: oliveCoord.url, search: "women olive green co ord set" },
  { id: "teal", name: "Teal polo", category: "Everyday", image: tealPolo.url, search: "men teal polo shirt" },
  { id: "pink", name: "Pink blazer", category: "A pop of color", image: pinkBlazer.url, search: "women dusty pink blazer" },
];
const firstProduct: Product = products[0] ?? { id: "black", name: "Black blazer", category: "Tailored", image: blackBlazer.url, search: "women black tailored blazer" };

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
  return `https://www.amazon.in/s?k=${encodeURIComponent(product.search)}`;
}

function PreviewPhoto({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="relative size-full overflow-hidden bg-surface">
    {!loaded && !failed && <div className="absolute inset-0 grid place-items-center" role="status" aria-label="Loading image"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>}
    {failed ? <div className="flex size-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Image unavailable</div> : <img src={src} alt={alt} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`size-full object-cover ${loaded ? "" : "invisible"}`} />}
  </div>;
}

function LookImage({ person, product, generated, comparison = false }: { person: string; product: Product; generated?: string | undefined; comparison?: boolean }) {
  const [generatedFailed, setGeneratedFailed] = useState(false);
  useEffect(() => setGeneratedFailed(false), [generated]);
  const showGenerated = Boolean(generated && !generatedFailed);
  return <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface">
    {showGenerated && generated ? <div className="size-full"><img src={generated} alt={`AI visualization of you wearing ${product.name}`} onError={() => setGeneratedFailed(true)} className={`size-full object-cover ${comparison && product.id === "teal" ? "scale-125" : ""}`} /></div> : <PreviewPhoto key={person} src={person} alt="Your original photo — no outfit has been generated yet" />}
    <span className="absolute bottom-3 left-3 rounded bg-overlay px-2.5 py-1 text-[10px] font-semibold text-overlay-foreground">{showGenerated ? "ShopLook.ai" : "Your original photo"}</span>
    {generatedFailed && <span role="alert" className="absolute right-3 top-3 rounded bg-overlay px-2 py-1 text-xs text-overlay-foreground">AI image unavailable · showing your photo</span>}
  </div>;
}

function ShopLook() {
  const [view, setView] = useState<"start" | "try" | "compare">("start");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState("");
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
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
      setError("Choose a JPG, PNG or WebP photo under 8 MB."); event.target.value = ""; return;
    }
    setError(""); setPhoto(URL.createObjectURL(file)); setPhotoFile(file); setGenerated({}); setGenerationError("");
    event.target.value = "";
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function useSample() {
    setPhoto(null); setPhotoFile(null); setGenerated({}); setGenerationError(""); setError(""); setView("try");
    void generateLook(firstProduct, null);
  }

  function selectProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product || generating) return;
    setGenerationError("");
    if (generated[id]) setActiveId(id);
    else void generateLook(product);
  }

  async function generateLook(product: Product, sourceFile: File | null = photoFile) {
    if (generating) return;
    setGenerating(product.id); setGenerationError("");
    try {
      const source = sourceFile ?? new File([await (await fetch(samplePerson)).blob()], "sample.jpg", { type: "image/jpeg" });
      const garmentBlob = await (await fetch(product.image)).blob();
      const garment = new File([garmentBlob], `${product.id}.${garmentBlob.type === "image/webp" ? "webp" : "jpg"}`, { type: garmentBlob.type });
      const form = new FormData();
      form.append("person", source); form.append("garment", garment); form.append("note", note);
      const response = await fetch("/api/generate-look", { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { image?: string; message?: string };
      if (!response.ok || !result.image) throw new Error(result.message ?? "OpenRouter could not make this look right now.");
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

  function reset() { setView("start"); setPhoto(null); setPhotoFile(null); setGenerated({}); setGenerationError(""); setNote(""); setFavorites([]); setActiveId(firstProduct.id); setShareId(null); setMessage(""); }

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
      <div className="mt-6 overflow-hidden rounded-md bg-surface">
        <Button type="button" variant="ghost" className="relative aspect-[5/4] h-auto w-full rounded-none p-0" onClick={() => fileRef.current?.click()} aria-label={photo ? "Change your photo" : "Upload your photo"}>
          {photo ? <img src={photo} alt="Your photo preview" className="size-full object-cover" /> : <div className="flex size-full flex-col items-center justify-center gap-3 bg-surface"><span className="grid size-14 place-items-center rounded-full bg-background text-primary"><ImagePlus className="size-6" /></span><span className="font-display text-2xl">Add your photo</span><span className="text-xs text-muted-foreground">Choose a clear picture of yourself</span></div>}
          {photo && <span className="absolute bottom-3 right-3 rounded bg-overlay px-3 py-1.5 text-xs text-overlay-foreground"><Check className="mr-1 inline size-3" /> Photo ready · tap to change</span>}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose your photo" className="sr-only" onChange={upload} />
      <label htmlFor="style-note" className="mt-5 block text-sm font-semibold">What kind of look are you after? <span className="font-normal text-muted-foreground">Optional</span></label>
      <div className="mt-2 flex items-start gap-3 rounded-md border border-input bg-background px-3 py-3 focus-within:ring-1 focus-within:ring-ring">
        <MessageCircle className="mt-1 size-4 shrink-0 text-primary" />
        <textarea id="style-note" value={note} maxLength={280} rows={2} onChange={(event) => setNote(event.target.value)} placeholder="Something for brunch, an easy work look…" className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
       <Button className="mt-5 h-12 w-full text-base" disabled={!photo} onClick={() => { setView("try"); void generateLook(firstProduct); }}>Create my virtual look <Sparkles /></Button>
        <Button variant="ghost" className="mt-2 h-14 w-full justify-start gap-3 border border-border px-3 text-sm" onClick={useSample}><img src={samplePerson} alt="" className="size-10 rounded-sm object-cover" /><span className="flex-1 text-left">Create a look with a sample photo</span><ArrowRight className="size-4" /></Button>
        <p className="mt-4 text-center text-[11px] leading-4 text-muted-foreground">Creating a look sends your photo, the selected product and your style note to OpenRouter. Uploading alone keeps your photo on this device.</p>
    </section>}

    {view === "try" && <section className="pb-12">
       <div className="px-5 pb-4 pt-6"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Your style studio</p><h1 className="mt-1 font-display text-4xl">Try a new look</h1>{note && <p className="mt-2 border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">“{note}”</p>}</div>
         <div className="relative"><LookImage person={person} product={active} generated={generated[active.id]} />{generating && <div role="status" className="absolute inset-x-0 top-0 flex items-center gap-2 bg-overlay px-4 py-3 text-sm text-overlay-foreground"><LoaderCircle className="size-4 animate-spin" /> Creating your {products.find((product) => product.id === generating)?.name ?? "next"} look…</div>}</div>
         <div className="flex items-center justify-between gap-3 px-5 pt-4"><div className="min-w-0"><h2 className="font-display text-2xl">{active.name}</h2><p className="text-xs text-muted-foreground">{generated[active.id] ? "AI visualization · not a fit guarantee" : `${active.category} · showing your original photo until your look is ready`}</p></div><Button variant="outline" size="icon" className="size-11 shrink-0" disabled={!generated[active.id]} aria-label={favorites.includes(active.id) ? `Remove ${active.name} from favorites` : `Favorite ${active.name}`} aria-pressed={favorites.includes(active.id)} onClick={() => toggleFavorite(active.id)}><Heart className={favorites.includes(active.id) ? "fill-primary text-primary" : ""} /></Button></div>
          <div className="px-5 pt-3"><p className="text-center text-[11px] leading-4 text-muted-foreground">Tap a product below to create another look. Your photo, the product photo and style note are sent to OpenRouter. AI images may change the fit, color, fabric or product details.</p>{generationError && <p role="alert" className="mt-2 text-center text-xs text-destructive">{generationError} Tap the product again to retry.</p>}</div>
      <div className="mt-6 flex items-center justify-between px-5"><h2 className="font-display text-2xl">Try another piece</h2><span className="text-xs text-muted-foreground">Swipe to explore →</span></div>
         <div className="mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-3 scrollbar-thin">{products.map((product) => <Button key={product.id} variant="ghost" disabled={Boolean(generating)} aria-label={`Try ${product.name} on me`} aria-pressed={activeId === product.id} onClick={() => selectProduct(product.id)} className={`h-auto w-32 shrink-0 snap-start flex-col items-stretch gap-0 overflow-hidden rounded-md border p-0 text-left ${activeId === product.id || generating === product.id ? "border-primary" : "border-border"}`}><span className="aspect-[4/5] w-full bg-surface"><img src={product.image} alt="" loading="lazy" width={768} height={1024} className="size-full object-contain" /></span><span className="block w-full truncate px-2 py-2 text-xs font-medium">{product.name}</span></Button>)}</div>
        <div className="mt-5 grid grid-cols-2 gap-2 px-5"><Button variant="outline" className="h-11" disabled={!generated[active.id]} onClick={() => setShareId(active.id)}><Share2 /> Share</Button><Button asChild className="h-11"><a href={shopUrl(active)} target="_blank" rel="noopener noreferrer"><ShoppingBag /> Buy</a></Button></div>
      <p className="mt-2 px-5 text-center text-[11px] text-muted-foreground">Buy opens a product search on Amazon India; exact items, prices and stock may vary.</p>
         <div className="mx-5 mt-7 border-t border-border pt-5"><Button className="h-12 w-full" disabled={favorites.length === 0} onClick={() => setView("compare")}>Compare favorites ({favorites.length}) <ArrowRight /></Button><p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">{favorites.length === 0 ? "Generate a virtual look, then heart it to compare. " : ""}Only generated looks appear in your comparison.</p></div>
    </section>}

    {view === "compare" && <section className="px-4 pb-12 pt-6"><p className="px-1 text-xs font-semibold uppercase tracking-widest text-primary">The shortlist</p><h1 className="mt-1 px-1 font-display text-4xl">Compare your looks</h1><p className="mt-2 px-1 text-sm text-muted-foreground">{comparison.length} favorites · scroll for more</p>
        <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-7">{comparison.map((product) => <article key={product.id} className="min-w-0"><LookImage person={person} product={product} generated={generated[product.id]} comparison /><div className="flex min-h-12 items-center justify-between gap-1 py-2"><h2 className="min-w-0 truncate font-display text-lg">{product.name}</h2><Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Remove ${product.name} from comparison`} onClick={() => toggleFavorite(product.id)}><Heart className="fill-primary text-primary" /></Button></div><div className="grid grid-cols-2 gap-1"><Button variant="outline" className="h-9 px-1 text-xs" onClick={() => setShareId(product.id)}><Share2 /> Share</Button><Button asChild className="h-9 px-1 text-xs"><a href={shopUrl(product)} target="_blank" rel="noopener noreferrer"><ShoppingBag /> Buy</a></Button></div></article>)}</div>
        {comparison.length === 0 && <div className="py-16 text-center"><Heart className="mx-auto mb-3 size-7 text-primary" /><p className="text-sm text-muted-foreground">Your shortlist is empty. Generate a look and heart it to compare here.</p></div>}
        <Button variant="outline" className="mt-8 h-11 w-full" onClick={() => setView("try")}>Try more apparel</Button><p className="mt-4 text-center text-[11px] text-muted-foreground">AI visualizations are not fit guarantees · Buy opens Amazon India search results</p>
    </section>}

    {shareProduct && <div role="dialog" aria-modal="true" aria-label={`Share ${shareProduct.name}`} className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareId(null); }}><div className="w-full max-w-[430px] rounded-t-lg bg-background p-5 shadow-sheet"><div className="flex items-center justify-between"><h2 className="font-display text-2xl">Share this look</h2><Button variant="ghost" size="icon" aria-label="Close share options" onClick={() => setShareId(null)}><X /></Button></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Share the preview image using your phone’s share menu, or download it to post yourself.</p><div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={() => void shareImage(shareProduct)}><Instagram /> Instagram</Button><Button variant="outline" className="h-12" onClick={() => void shareImage(shareProduct)}><MessageCircle /> WhatsApp</Button></div><Button variant="outline" className="mt-2 h-12 w-full" onClick={() => void copyLink()}><LinkIcon /> Copy app link</Button><p className="mt-3 text-[11px] leading-4 text-muted-foreground">The copied link opens ShopLook, not your private photo. Instagram and WhatsApp need their apps or your device’s share menu.</p>{message && <p role="status" className="mt-3 text-xs text-primary">{message}</p>}</div></div>}
  </ShopLookShell>;
}
