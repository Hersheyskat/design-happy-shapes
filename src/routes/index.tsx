import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Expand,
  ImagePlus,
  LoaderCircle,
  Link as LinkIcon,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  Sparkles,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import sampleCoral from "@/assets/shoplook-coral.jpg";
import sampleBlack from "@/assets/shoplook-black.jpg";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { analyseShopLook } from "@/lib/style-advice.functions";
import type { StyleAdvice } from "@/lib/style-advice.types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shop Your Look — Personal, fun fashion shopping" },
      {
        name: "description",
        content: "Fashion shopping made personal and fun. Upload a product and your photo to create, compare, share, and shop your look.",
      },
      { property: "og:title", content: "Shop Your Look — Personal, fun fashion shopping" },
      {
        property: "og:description",
        content: "Fashion shopping made personal and fun. Upload a product and your photo to create, compare, share, and shop your look.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopLook,
});

type View = "start" | "processing" | "advice" | "compare" | "detail";
type Look = { src: string; name: string; note: string; uploaded: boolean };
type UploadKind = "shopper" | "product";

type UploadPhoto = {
  file: File;
  preview: string;
};

const sampleLooks: Look[] = [
  { src: sampleCoral, name: "Look 01", note: "Warm accent · relaxed proportions", uploaded: false },
  { src: sampleBlack, name: "Look 02", note: "Monochrome · sharper finish", uploaded: false },
];
const fallbackLook: Look = { src: sampleCoral, name: "Look 01", note: "Warm accent · relaxed proportions", uploaded: false };

function ShopLook() {
  const [view, setView] = useState<View>("start");
  const [looks, setLooks] = useState<Look[]>([]);
  const [shopperPhoto, setShopperPhoto] = useState<UploadPhoto | null>(null);
  const [productPhoto, setProductPhoto] = useState<UploadPhoto | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [advice, setAdvice] = useState<StyleAdvice | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState([1]);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const analyse = useServerFn(analyseShopLook);

  useEffect(() => {
    return () => {
      looks.forEach((look) => {
        if (look.uploaded && look.src.startsWith("blob:")) URL.revokeObjectURL(look.src);
      });
    };
  }, [looks]);

  const setUpload = (kind: UploadKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAnalysisError(null);
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
      setAnalysisError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 12_000_000) {
      setAnalysisError("Choose an image smaller than 12 MB.");
      return;
    }
    const update = kind === "shopper" ? setShopperPhoto : setProductPhoto;
    update((current) => {
      if (current?.preview.startsWith("blob:")) URL.revokeObjectURL(current.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  };

  const runAnalysis = async () => {
    if (!shopperPhoto || (!productPhoto && !productUrl.trim())) return;
    setView("processing");
    setAnalysisError(null);
    try {
      const shopperImage = await imageToDataUrl(shopperPhoto.file);
      const productImage = productPhoto ? await imageToDataUrl(productPhoto.file) : null;
      const result = await analyse({
        data: {
          shopperImage,
          shopperMime: "image/jpeg",
          productImage,
          productMime: productImage ? "image/jpeg" : null,
          productUrl: productUrl.trim() || null,
        },
      });
      if (!result.ok) {
        setAnalysisError(result.error);
        setView("start");
        return;
      }
      setAdvice(result.advice);
      setLooks([
        { src: shopperPhoto.preview, name: "Your look", note: "Current outfit", uploaded: false },
        ...(productPhoto ? [{ src: productPhoto.preview, name: "Product", note: "Product reference", uploaded: false }] : []),
      ]);
      setView("advice");
    } catch {
      setAnalysisError("ShopLook could not prepare these images. Please try different photos.");
      setView("start");
    }
  };

  const replaceLook = (slot: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    setLooks((current) => {
      const previous = current[slot];
      if (previous?.uploaded && previous.src.startsWith("blob:")) URL.revokeObjectURL(previous.src);
      const next = [...current];
      next[slot] = {
        src,
        name: `Look ${String(slot + 1).padStart(2, "0")}`,
        note: file.name.replace(/\.[^/.]+$/, ""),
        uploaded: true,
      };
      return next;
    });
  };

  const addLook = (event: ChangeEvent<HTMLInputElement>) => replaceLook(looks.length, event);

  const compare = () => {
    if (!looks[0] || !looks[1]) return;
    setView("processing");
    window.setTimeout(() => setView("compare"), 850);
  };

  const reset = () => {
    if (shopperPhoto?.preview.startsWith("blob:")) URL.revokeObjectURL(shopperPhoto.preview);
    if (productPhoto?.preview.startsWith("blob:")) URL.revokeObjectURL(productPhoto.preview);
    setView("start");
    setLooks([]);
    setShopperPhoto(null);
    setProductPhoto(null);
    setProductUrl("");
    setAdvice(null);
    setAnalysisError(null);
    setSelected(0);
    setZoom([1]);
  };

  const activeLook = looks[selected] ?? looks[0] ?? fallbackLook;

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] border-x border-border/70 bg-background shadow-page">
        <AppHeader
          showBack={view === "detail" || view === "advice"}
          onBack={() => setView(view === "detail" ? "compare" : "start")}
          onReset={reset}
          showReset={view !== "start" && view !== "processing"}
        />
        {view === "start" && (
          <StartView
            shopperPhoto={shopperPhoto}
            productPhoto={productPhoto}
            productUrl={productUrl}
            error={analysisError}
            onUpload={setUpload}
            onUrlChange={setProductUrl}
            onAnalyse={runAnalysis}
            onSamples={() => { setLooks(sampleLooks); setView("compare"); }}
          />
        )}
        {view === "processing" && <ProcessingView shopperPhoto={shopperPhoto} productPhoto={productPhoto} />}
        {view === "advice" && advice && shopperPhoto && (
          <AdviceView
            shopperPhoto={shopperPhoto}
            productPhoto={productPhoto}
            productUrl={productUrl}
            advice={advice}
            onCompare={() => setView("compare")}
          />
        )}
        {view === "compare" && (
          <CompareView
            looks={looks}
            selected={selected}
            onSelect={setSelected}
            onAdd={addLook}
            onFull={() => setView("detail")}
            onShare={() => setShareOpen(true)}
          />
        )}
        {view === "detail" && activeLook && (
          <DetailView look={activeLook} zoom={zoom} onZoom={setZoom} />
        )}
      </div>
      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share comparison">
        <ShareSheet looks={looks} activeLook={activeLook} copied={copied} setCopied={setCopied} />
      </BottomSheet>
    </main>
  );
}

async function imageToDataUrl(file: File) {
  const image = await createImageBitmap(file);
  const maxSide = 1200;
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function AppHeader({ showBack, showReset, onBack, onReset }: { showBack: boolean; showReset: boolean; onBack: () => void; onReset: () => void }) {
  return (
    <header className="grid h-16 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-border px-3">
      {showBack ? <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back" className="h-11 w-11 rounded-full"><ArrowLeft /></Button> : <span />}
      <button onClick={onReset} className="font-display text-2xl font-semibold" aria-label="Return to ShopLook start">ShopLook</button>
      {showReset ? <Button variant="ghost" size="icon" onClick={onReset} aria-label="Start over" className="h-11 w-11 rounded-full"><RotateCcw /></Button> : <span />}
    </header>
  );
}

function StartView({ shopperPhoto, productPhoto, productUrl, error, onUpload, onUrlChange, onAnalyse, onSamples }: { shopperPhoto: UploadPhoto | null; productPhoto: UploadPhoto | null; productUrl: string; error: string | null; onUpload: (kind: UploadKind, event: ChangeEvent<HTMLInputElement>) => void; onUrlChange: (value: string) => void; onAnalyse: () => void; onSamples: () => void }) {
  const ready = Boolean(shopperPhoto && (productPhoto || productUrl.trim()));
  return (
    <section className="px-5 pb-12 pt-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Your personal AI shopping assistant</p>
      <h1 className="max-w-sm font-display text-[3.35rem] leading-[0.94] font-medium">Shop your look</h1>
      <p className="mt-4 max-w-sm text-lg leading-7 text-muted-foreground">Fashion shopping made personal and fun.</p>
      <ol className="mt-6 space-y-3 border-y border-border py-5 text-sm leading-5">
        {[
          "Upload a screenshot or link of clothing or footwear you like.",
          "Upload your photo.",
          "Our fashion shopping AI assistant creates your look with the product.",
          "Compare, share, and buy the best look.",
        ].map((step, index) => (
          <li key={step} className="grid grid-cols-[1.75rem_1fr] items-start gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{index + 1}</span>
            <span className="pt-1 text-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <PhotoInput title="Your photo" detail="A clear, full outfit" photo={shopperPhoto} icon={<ImagePlus />} onChange={(event) => onUpload("shopper", event)} />
        <PhotoInput title="Product" detail="Screenshot or photo" photo={productPhoto} icon={<Upload />} onChange={(event) => onUpload("product", event)} />
      </div>
      <div className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"><span className="h-px flex-1 bg-border" />or use a product link<span className="h-px flex-1 bg-border" /></div>
      <label className="flex h-12 items-center gap-3 rounded-lg border border-input bg-background px-3 focus-within:ring-1 focus-within:ring-ring">
        <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Product link</span>
        <input type="url" inputMode="url" value={productUrl} onChange={(event) => onUrlChange(event.target.value)} placeholder="Paste a product link" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>
      {error && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm leading-5 text-destructive">{error}</div>}
      <Button className="mt-5 h-13 w-full rounded-lg text-base" disabled={!ready} onClick={onAnalyse}><Sparkles /> See the magic</Button>
      {!ready && <p className="mt-3 text-center text-xs text-muted-foreground">Add your photo and a product screenshot or link</p>}
      <Button variant="ghost" className="mt-2 h-11 w-full text-xs text-muted-foreground" onClick={onSamples}>Or explore a sample comparison</Button>
      <div className="mt-7 flex items-start gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface"><Check className="size-3" /></span>
        <p>Your images are sent securely only when you ask for suggestions. ShopLook gives styling advice; it never alters how you look.</p>
      </div>
    </section>
  );
}

function PhotoInput({ title, detail, photo, icon, onChange }: { title: string; detail: string; photo: UploadPhoto | null; icon: ReactNode; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("overflow-hidden rounded-lg border", photo ? "border-primary/50 bg-primary-soft" : "border-border bg-surface")}>
      <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()} className="relative aspect-[3/4] h-auto w-full rounded-none p-0" aria-label={`Choose ${title.toLowerCase()}`}>
        {photo ? <img src={photo.preview} alt={`${title} preview`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-muted-foreground">{icon}</span>}
        {photo && <span className="absolute right-2 top-2 rounded-full bg-overlay px-2 py-1 text-[10px] font-semibold text-overlay-foreground">Ready</span>}
      </Button>
      <div className="p-3">
        <p className="font-display text-lg">{title}</p>
        <p className="mt-0.5 min-h-8 text-[11px] leading-4 text-muted-foreground">{photo ? photo.file.name : detail}</p>
        <Button variant="link" className="mt-1 h-7 p-0 text-xs" onClick={() => inputRef.current?.click()}>{photo ? "Replace" : "Add photo"} <Upload /></Button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChange} aria-label={`Choose ${title.toLowerCase()}`} />
    </div>
  );
}

function LookUpload({ slot, look, onChange }: { slot: number; look?: Look; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = `Choose look ${slot + 1}`;
  return (
    <div className={cn("overflow-hidden rounded-lg border", look ? "border-primary/50 bg-primary-soft" : "border-border bg-surface")}>
      <button type="button" onClick={() => inputRef.current?.click()} className="relative aspect-[3/4] w-full overflow-hidden" aria-label={label}>
        {look ? <img src={look.src} alt={`Preview of look ${slot + 1}`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><ImagePlus className="size-7 text-muted-foreground" /></span>}
        <span className="absolute left-2 top-2 rounded-full bg-overlay px-2 py-1 text-[10px] font-semibold text-overlay-foreground">{String(slot + 1).padStart(2, "0")}</span>
      </button>
      <div className="p-3">
        <p className="font-display text-lg">{look ? look.name : `Look ${slot + 1}`}</p>
        <Button variant="link" className="mt-1 h-7 p-0 text-xs" onClick={() => inputRef.current?.click()}>{look ? "Replace" : "Add photo"} <Upload /></Button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onChange} aria-label={label} />
    </div>
  );
}

function ProcessingView({ shopperPhoto, productPhoto }: { shopperPhoto: UploadPhoto | null; productPhoto: UploadPhoto | null }) {
  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-8 text-center">
      <div className="relative mb-8 flex -space-x-5">
        {[shopperPhoto, productPhoto].filter((photo): photo is UploadPhoto => Boolean(photo)).map((photo, index) => <img key={photo.preview} src={photo.preview} alt={index === 0 ? "Your outfit" : "Product reference"} className="size-24 rounded-full border-4 border-background object-cover" />)}
        <span className="absolute -inset-2 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Finding the connection</p>
      <h1 className="mt-3 font-display text-4xl font-medium">Styling your look</h1>
      <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">Reading color, proportion, texture, and how the new piece can work with your outfit.</p>
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Preparing your suggestions</div>
    </section>
  );
}

function AdviceView({ shopperPhoto, productPhoto, productUrl, advice, onCompare }: { shopperPhoto: UploadPhoto; productPhoto: UploadPhoto | null; productUrl: string; advice: StyleAdvice; onCompare: () => void }) {
  return (
    <section className="pb-10">
      <div className="grid h-[23rem] grid-cols-[1fr_0.72fr] gap-1 bg-surface p-1">
        <img src={shopperPhoto.preview} alt="Your uploaded outfit" className="h-full w-full rounded-md object-cover" />
        <div className="grid min-h-0 gap-1">
          {productPhoto ? <img src={productPhoto.preview} alt="Product reference" className="h-full min-h-0 w-full rounded-md object-cover" /> : <div className="grid h-full place-items-center rounded-md bg-primary-soft p-4 text-center"><LinkIcon className="mb-3 size-5 text-primary" /><p className="break-words text-xs leading-5 text-muted-foreground">{productUrl}</p></div>}
        </div>
      </div>
      <div className="px-5 pt-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your style edit</p>
        <h1 className="mt-2 font-display text-4xl font-medium leading-none">{advice.headline}</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{advice.summary}</p>

        <div className="mt-7 border-t border-border pt-6">
          <div className="flex items-center gap-2"><Palette className="size-4 text-primary" /><h2 className="font-display text-2xl">Colors to bring in</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {advice.colors.map((color) => <div key={`${color.name}-${color.hex}`} className="rounded-lg border border-border bg-surface p-3"><span className="block h-10 rounded-md border border-border" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex : "var(--muted)" }} /><p className="mt-2 text-sm font-semibold">{color.name}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{color.use}</p></div>)}
          </div>
        </div>

        <div className="mt-7 border-t border-border pt-6">
          <div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><h2 className="font-display text-2xl">Small changes, stronger look</h2></div>
          <ol className="mt-3 divide-y divide-border">
            {advice.adjustments.map((item, index) => <li key={`${item.title}-${index}`} className="grid grid-cols-[28px_1fr] gap-3 py-4"><span className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{index + 1}</span><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div></li>)}
          </ol>
        </div>
        <Button className="mt-6 h-12 w-full rounded-lg" onClick={onCompare}><Expand /> Compare this look</Button>
        <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">AI suggestions are a starting point—your taste is the final word.</p>
      </div>
    </section>
  );
}

function CompareView({ looks, selected, onSelect, onAdd, onFull, onShare }: { looks: Look[]; selected: number; onSelect: (value: number) => void; onAdd: (event: ChangeEvent<HTMLInputElement>) => void; onFull: () => void; onShare: () => void }) {
  const addRef = useRef<HTMLInputElement>(null);
  const active = looks[selected] ?? looks[0];
  return (
    <section className="px-4 pb-10 pt-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Look comparison</p>
      <div className="mt-2 flex items-end justify-between gap-4"><h1 className="font-display text-4xl font-medium leading-none">Which one<br />wins?</h1><span className="pb-1 text-xs text-muted-foreground">{looks.length}/4 looks</span></div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {looks.map((look, index) => (
          <button key={`${look.src}-${index}`} onClick={() => onSelect(index)} onDoubleClick={onFull} className={cn("group relative aspect-[3/4] overflow-hidden rounded-md border-2 bg-surface", selected === index ? "border-primary" : "border-transparent")} aria-label={`Select ${look.name}`}>
            <img src={look.src} alt={`${look.name} comparison`} className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-overlay text-xs font-semibold text-overlay-foreground">{index + 1}</span>
            {selected === index && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-4" /></span>}
            <span className="absolute inset-x-0 bottom-0 bg-image-caption p-3 text-left text-xs font-medium text-overlay-foreground">{look.name}</span>
          </button>
        ))}
        {looks.length < 4 && (
          <button onClick={() => addRef.current?.click()} className="grid aspect-[3/4] place-items-center rounded-md border border-dashed border-border bg-surface text-muted-foreground" aria-label="Add another look"><span className="text-center text-xs"><Plus className="mx-auto mb-2 size-6" />Add another look</span></button>
        )}
      </div>
      <input ref={addRef} type="file" accept="image/*" className="sr-only" onChange={onAdd} aria-label="Choose another look" />
      {active && <div className="mt-5 rounded-lg bg-primary-soft p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Current pick</p><p className="mt-2 font-display text-xl leading-6">{active.name} has the strongest overall balance. Select another look to compare its details.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{active.note}</p></div>}
      <div className="mt-5 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12 rounded-lg shadow-none" onClick={onFull}><Expand /> Full size</Button><Button className="h-12 rounded-lg" onClick={onShare}><Share2 /> Share comparison</Button></div>
    </section>
  );
}

function DetailView({ look, zoom, onZoom }: { look: Look; zoom: number[]; onZoom: (value: number[]) => void }) {
  return (
    <section className="pb-9">
      <div className="relative aspect-[4/5] overflow-hidden bg-surface"><img src={look.src} alt={`Full view of ${look.name}`} className="h-full w-full object-cover transition-transform duration-300" style={{ transform: `scale(${zoom[0] ?? 1})` }} /><span className="absolute bottom-4 left-4 rounded-full bg-overlay px-3 py-1.5 text-xs text-overlay-foreground">{look.name}</span></div>
      <div className="px-5 pt-6"><div className="flex items-center gap-4"><ZoomOut className="size-4 text-muted-foreground" /><Slider min={1} max={2.2} step={0.1} value={zoom} onValueChange={onZoom} aria-label="Zoom image" /><ZoomIn className="size-4 text-muted-foreground" /></div><p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Zoom in to compare styling details. The original image remains unchanged.</p></div>
    </section>
  );
}

function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:px-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="max-h-[86dvh] w-full max-w-[430px] overflow-y-auto rounded-t-xl bg-background p-5 shadow-sheet animate-in slide-in-from-bottom-8 duration-300"><div className="mb-5 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center"><span /><h2 className="text-center font-display text-2xl font-medium">{title}</h2><Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" onClick={onClose} aria-label="Close"><X /></Button></div>{children}</section></div>;
}

function ShareSheet({ looks, activeLook, copied, setCopied }: { looks: Look[]; activeLook: Look; copied: boolean; setCopied: (value: boolean) => void }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch { /* unavailable in some preview contexts */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const share = async () => {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: "My ShopLook comparison", text: "Which look would you choose?", url: window.location.href });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  };
  return (
    <div>
      <div className="mx-auto grid aspect-[4/3] w-56 grid-cols-2 gap-1 overflow-hidden rounded-md bg-surface">{looks.slice(0, 4).map((look, index) => <img key={`${look.src}-${index}`} src={look.src} alt={`Comparison look ${index + 1}`} className="h-full min-h-0 w-full object-cover" />)}</div>
      <p className="mx-auto mt-4 max-w-xs text-center text-sm leading-6 text-muted-foreground">Send the comparison and ask friends which complete look they prefer.</p>
      <Button className="mt-6 h-12 w-full rounded-lg" onClick={share}><Share2 /> Share comparison</Button>
      <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" className="h-12 rounded-lg shadow-none" onClick={() => { const a = document.createElement("a"); a.href = activeLook.src; a.download = "shoplook-selection.jpg"; a.click(); }}><Download /> Save pick</Button><Button variant="outline" className="h-12 rounded-lg shadow-none" onClick={copy}><Copy /> {copied ? "Copied" : "Copy link"}</Button></div>
    </div>
  );
}