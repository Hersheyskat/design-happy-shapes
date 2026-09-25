import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Expand,
  ExternalLink,
  ImagePlus,
  Instagram,
  Link2,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  Plus,
  RotateCcw,
  Share2,
  ShoppingBag,
  Sparkles,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import coralLook from "@/assets/shoplook-coral.jpg";
import blackLook from "@/assets/shoplook-black.jpg";
import sageLook from "@/assets/shoplook-sage.jpg";
import creamLook from "@/assets/shoplook-cream.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShopLook — See yourself in it" },
      {
        name: "description",
        content: "Try a product with your own photo, compare looks, and shop your favourite.",
      },
      { property: "og:title", content: "ShopLook — See yourself in it" },
      {
        property: "og:description",
        content: "Try a product with your own photo, compare looks, and shop your favourite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopLook,
});

type View = "start" | "processing" | "look" | "detail" | "compare";
type SheetName = "share" | "buy" | "pose" | null;

const looks = [
  { src: coralLook, name: "Coral Court", colour: "Coral / Chalk", price: "Illustrative price" },
  { src: blackLook, name: "Mono Court", colour: "Black / Black", price: "Illustrative price" },
  { src: sageLook, name: "Terrace 72", colour: "Sage / Cream", price: "Illustrative price" },
  { src: creamLook, name: "Archive Gum", colour: "Chalk / Gum", price: "Illustrative price" },
] as const;

function getLook(index: number) {
  return looks[index] ?? looks[0];
}

function ShopLook() {
  const [view, setView] = useState<View>("start");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [personPhoto, setPersonPhoto] = useState<string | null>(null);
  const [productPhoto, setProductPhoto] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [selected, setSelected] = useState(0);
  const [compareCount, setCompareCount] = useState(1);
  const [zoom, setZoom] = useState([1]);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("The coral pair gives this clean look a warm, confident finish.");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (personPhoto?.startsWith("blob:")) URL.revokeObjectURL(personPhoto);
      if (productPhoto?.startsWith("blob:")) URL.revokeObjectURL(productPhoto);
    };
  }, [personPhoto, productPhoto]);

  const setFile = (event: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const file = event.target.files?.[0];
    if (file) setter(URL.createObjectURL(file));
  };

  const createLook = () => {
    if (!personPhoto || (!productPhoto && !productUrl.trim())) return;
    setView("processing");
    window.setTimeout(() => setView("look"), 1450);
  };

  const sendMessage = (preset?: string) => {
    const text = preset ?? message;
    if (!text.trim()) return;
    setReply(
      text.toLowerCase().includes("black")
        ? "Black makes the outfit sharper and more understated. I’d choose coral for personality, black for versatility."
        : text.toLowerCase().includes("better")
          ? "The coral pair is my pick—it balances the black denim and adds just enough colour."
          : "That would change the picture. Confirm a new version when you’re ready; your current look will stay saved.",
    );
    setMessage("");
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] border-x border-border/70 bg-background shadow-page">
        <AppHeader
          showBack={view !== "start" && view !== "processing"}
          onBack={() => setView(view === "detail" || view === "compare" ? "look" : "start")}
          onReset={() => {
            setView("start");
            setPersonPhoto(null);
            setProductPhoto(null);
            setProductUrl("");
            setCompareCount(1);
          }}
        />

        {view === "start" && (
          <StartView
            personPhoto={personPhoto}
            productPhoto={productPhoto}
            productUrl={productUrl}
            onPerson={(event) => setFile(event, setPersonPhoto)}
            onProduct={(event) => setFile(event, setProductPhoto)}
            onUrl={setProductUrl}
            onCreate={createLook}
          />
        )}
        {view === "processing" && <ProcessingView productPhoto={productPhoto} />}
        {view === "look" && (
          <LookView
            selected={selected}
            reply={reply}
            message={message}
            onMessage={setMessage}
            onSend={sendMessage}
            onDetail={() => setView("detail")}
            onCompare={() => setView("compare")}
            onShare={() => setSheet("share")}
            onBuy={() => setSheet("buy")}
          />
        )}
        {view === "detail" && (
          <DetailView
            selected={selected}
            zoom={zoom}
            onZoom={setZoom}
            onPose={() => setSheet("pose")}
          />
        )}
        {view === "compare" && (
          <CompareView
            selected={selected}
            count={compareCount}
            onSelect={setSelected}
            onAdd={() => setCompareCount((count) => Math.min(4, count + 1))}
            onFull={() => setView("detail")}
            onShare={() => setSheet("share")}
          />
        )}
      </div>

      <BottomSheet open={sheet === "share"} onClose={() => setSheet(null)} title="Share this look">
        <ShareSheet selected={selected} copied={copied} setCopied={setCopied} />
      </BottomSheet>
      <BottomSheet open={sheet === "buy"} onClose={() => setSheet(null)} title="Buy the look">
        <BuySheet selected={selected} />
      </BottomSheet>
      <BottomSheet open={sheet === "pose"} onClose={() => setSheet(null)} title="Try a new pose">
        <PoseSheet
          onConfirm={() => {
            setSheet(null);
            setReply("Your foot-forward version is ready. The original look is still saved.");
            setView("look");
          }}
        />
      </BottomSheet>
    </main>
  );
}

function AppHeader({ showBack, onBack, onReset }: { showBack: boolean; onBack: () => void; onReset: () => void }) {
  return (
    <header className="grid h-16 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-border px-3">
      {showBack ? (
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back" className="h-11 w-11 rounded-full">
          <ArrowLeft />
        </Button>
      ) : (
        <span />
      )}
      <button onClick={onReset} className="font-display text-2xl font-semibold" aria-label="Return to ShopLook start">
        ShopLook
      </button>
      {showBack ? (
        <Button variant="ghost" size="icon" onClick={onReset} aria-label="Start over" className="h-11 w-11 rounded-full">
          <RotateCcw />
        </Button>
      ) : (
        <span />
      )}
    </header>
  );
}

function StartView(props: {
  personPhoto: string | null;
  productPhoto: string | null;
  productUrl: string;
  onPerson: (event: ChangeEvent<HTMLInputElement>) => void;
  onProduct: (event: ChangeEvent<HTMLInputElement>) => void;
  onUrl: (value: string) => void;
  onCreate: () => void;
}) {
  const canCreate = Boolean(props.personPhoto && (props.productPhoto || props.productUrl.trim()));
  return (
    <section className="px-5 pb-12 pt-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Your fitting room, anywhere</p>
      <h1 className="max-w-sm font-display text-[3.45rem] leading-[0.92] font-medium">See it.<br />See yourself in it.</h1>
      <p className="mt-5 max-w-sm text-[15px] leading-6 text-muted-foreground">
        Add one clear photo of you and the product you’re considering. We’ll bring the two together.
      </p>

      <div className="mt-9 space-y-3">
        <UploadCard
          number="01"
          title="A full-body photo"
          note="Clear, front-facing and head to toe works best."
          preview={props.personPhoto}
          label="Choose your photo"
          onChange={props.onPerson}
        />
        <UploadCard
          number="02"
          title="The product"
          note="Upload a screenshot, or paste the product page below."
          preview={props.productPhoto}
          label="Choose product screenshot"
          onChange={props.onProduct}
        />
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or paste a link</div>
      <div className="relative">
        <Link2 className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={props.productUrl}
          onChange={(event) => props.onUrl(event.target.value)}
          placeholder="https://retailer.com/product"
          aria-label="Product page link"
          className="h-13 rounded-lg bg-surface pl-11 pr-4 shadow-none"
        />
      </div>
      <Button className="mt-6 h-13 w-full rounded-lg text-base" disabled={!canCreate} onClick={props.onCreate}>
        <Sparkles /> Create my look
      </Button>
      {!canCreate && <p className="mt-3 text-center text-xs text-muted-foreground">Add both items to continue</p>}
      <div className="mt-8 flex items-start gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface"><Check className="size-3" /></span>
        <p>Your photos stay private on this device and are never shared unless you choose to share a finished look.</p>
      </div>
    </section>
  );
}

function UploadCard({ number, title, note, preview, label, onChange }: { number: string; title: string; note: string; preview: string | null; label: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("grid min-h-28 grid-cols-[minmax(0,1fr)_88px] gap-4 rounded-lg border p-4 transition-colors", preview ? "border-primary/40 bg-primary-soft" : "border-border bg-surface")}>
      <div className="min-w-0">
        <p className="mb-2 text-[10px] font-bold tracking-widest text-primary">{number}</p>
        <h2 className="font-display text-xl font-medium">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
        <Button variant="link" className="mt-2 h-7 p-0 text-xs" onClick={() => inputRef.current?.click()}>
          {preview ? "Change photo" : label} <Upload />
        </Button>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onChange} aria-label={label} />
      </div>
      <button onClick={() => inputRef.current?.click()} className="relative grid h-24 w-[88px] place-items-center overflow-hidden rounded-md border border-dashed border-border bg-background" aria-label={label}>
        {preview ? <img src={preview} alt="Selected preview" className="h-full w-full object-cover" /> : <ImagePlus className="size-6 text-muted-foreground" />}
        {preview && <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
      </button>
    </div>
  );
}

function ProcessingView({ productPhoto }: { productPhoto: string | null }) {
  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-8 text-center">
      <div className="relative mb-8 size-28">
        <img src={productPhoto ?? coralLook} alt="Product being styled" className="size-28 rounded-full object-cover" />
        <span className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Putting it together</p>
      <h1 className="mt-3 font-display text-4xl font-medium">Creating your look</h1>
      <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">Keeping your face, outfit and setting true to your photo.</p>
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Preparing an illustrative preview</div>
    </section>
  );
}

function LookView(props: { selected: number; reply: string; message: string; onMessage: (value: string) => void; onSend: (value?: string) => void; onDetail: () => void; onCompare: () => void; onShare: () => void; onBuy: () => void }) {
  const look = getLook(props.selected);
  return (
    <section className="pb-8">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        <img src={look.src} alt={`Illustrative ShopLook styling with ${look.name} shoes`} width={1024} height={1536} className="h-full w-full object-cover" />
        <Button variant="secondary" size="icon" onClick={props.onDetail} aria-label="Inspect look detail" className="absolute bottom-4 right-4 h-11 w-11 rounded-full shadow-float"><Expand /></Button>
        <span className="absolute left-4 top-4 rounded-full bg-overlay px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-overlay-foreground">Illustrative preview</span>
      </div>
      <div className="px-4">
        <div className="grid grid-cols-3 border-b border-border py-2">
          <ActionButton icon={<Share2 />} label="Share the look" onClick={props.onShare} />
          <ActionButton icon={<Maximize2 />} label="Compare" onClick={props.onCompare} />
          <ActionButton icon={<ShoppingBag />} label="Buy the look" onClick={props.onBuy} />
        </div>
        <div className="py-6">
          <div className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground font-display text-sm italic">S</span>
            <div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Stylist’s take</p><p className="mt-2 font-display text-[1.35rem] leading-7">{props.reply}</p></div>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["Show black jeans", "Which looks better?", "Bring my foot forward"].map((text) => (
              <Button key={text} variant="outline" className="h-9 shrink-0 rounded-full px-3 text-xs shadow-none" onClick={() => props.onSend(text)}>{text}</Button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2 rounded-lg border border-border bg-surface p-2">
            <Input value={props.message} onChange={(event) => props.onMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") props.onSend(); }} placeholder="Ask your stylist…" className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0" />
            <Button size="icon" className="h-11 w-11 rounded-full" onClick={() => props.onSend()} aria-label="Send message"><ArrowUp /></Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <Button variant="ghost" onClick={onClick} className="h-16 flex-col gap-1 rounded-none px-1 text-[11px] [&_svg]:size-5">{icon}{label}</Button>;
}

function DetailView({ selected, zoom, onZoom, onPose }: { selected: number; zoom: number[]; onZoom: (value: number[]) => void; onPose: () => void }) {
  const look = getLook(selected);
  return (
    <section className="pb-9">
      <div className="relative aspect-[4/5] overflow-hidden bg-surface">
        <img src={look.src} alt="Close view of the saved generated look" width={1024} height={1536} className="h-full w-full object-cover transition-transform duration-300" style={{ transform: `scale(${zoom[0] ?? 1})`, transformOrigin: "50% 82%" }} />
        <span className="absolute bottom-4 left-4 rounded-full bg-overlay px-3 py-1.5 text-xs text-overlay-foreground">Original saved image</span>
      </div>
      <div className="px-5 pt-6">
        <div className="flex items-center gap-4"><ZoomOut className="size-4 text-muted-foreground" /><Slider min={1} max={2.2} step={0.1} value={zoom} onValueChange={onZoom} aria-label="Zoom image" /><ZoomIn className="size-4 text-muted-foreground" /></div>
        <p className="mt-3 text-center text-xs text-muted-foreground">Zoom inspects this saved image. It doesn’t create or enhance detail.</p>
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Want a closer pose?</p>
          <h1 className="mt-2 font-display text-3xl font-medium">Bring the product forward</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">A new pose creates a separate illustrative version. Your current look stays saved.</p>
          <Button variant="outline" className="mt-5 h-12 w-full rounded-lg shadow-none" onClick={onPose}><Sparkles /> Try a new pose</Button>
        </div>
      </div>
    </section>
  );
}

function CompareView({ selected, count, onSelect, onAdd, onFull, onShare }: { selected: number; count: number; onSelect: (value: number) => void; onAdd: () => void; onFull: () => void; onShare: () => void }) {
  const selectedLook = getLook(selected);
  return (
    <section className="px-4 pb-10 pt-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Compare on you</p>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"><h1 className="font-display text-4xl font-medium leading-none">One pose.<br />Four options.</h1><span className="text-xs text-muted-foreground">{count}/4 added</span></div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        {looks.map((look, index) => index < count ? (
          <button key={look.name} onClick={() => onSelect(index)} onDoubleClick={onFull} className={cn("group relative aspect-[3/4] overflow-hidden rounded-md border-2 bg-surface", selected === index ? "border-primary" : "border-transparent")} aria-label={`Select ${look.name}`}>
            <img src={look.src} alt={`${look.name} comparison`} loading="lazy" width={1024} height={1536} className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-overlay text-xs font-semibold text-overlay-foreground">{index + 1}</span>
            {selected === index && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-4" /></span>}
            <span className="absolute inset-x-0 bottom-0 bg-image-caption p-3 text-left text-xs font-medium text-overlay-foreground">{look.name}</span>
          </button>
        ) : (
          <button key={look.name} onClick={onAdd} className="grid aspect-[3/4] place-items-center rounded-md border border-dashed border-border bg-surface text-muted-foreground" aria-label={`Add option ${index + 1}`}>
            <span className="text-center text-xs"><Plus className="mx-auto mb-2 size-6" />Add option {index + 1}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-primary-soft p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Stylist recommends</p>
        <p className="mt-2 font-display text-xl leading-6">{selectedLook.name} is the strongest match. It gives the outfit a clear focal point.</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12 rounded-lg shadow-none" onClick={onFull}><Expand /> Full size</Button>
        <Button className="h-12 rounded-lg" onClick={onShare}><Share2 /> Share quad</Button>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Each tile is a separate illustrative result using the same pose reference.</p>
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim px-0 sm:px-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="max-h-[86dvh] w-full max-w-[430px] overflow-y-auto rounded-t-xl bg-background p-5 shadow-sheet animate-in slide-in-from-bottom-8 duration-300">
        <div className="mb-5 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center"><span /><h2 className="text-center font-display text-2xl font-medium">{title}</h2><Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" onClick={onClose} aria-label="Close"><X /></Button></div>
        {children}
      </section>
    </div>
  );
}

function ShareSheet({ selected, copied, setCopied }: { selected: number; copied: boolean; setCopied: (value: boolean) => void }) {
  const look = getLook(selected);
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch { /* unavailable in some preview contexts */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const nativeShare = async () => {
    if (navigator.share) await navigator.share({ title: "My ShopLook", text: "Which pair would you choose?", url: window.location.href });
    else copy();
  };
  return (
    <div>
      <div className="mx-auto aspect-[4/3] w-40 overflow-hidden rounded-md bg-surface"><img src={look.src} alt="Look selected to share" className="h-full w-full object-cover" /></div>
      <p className="mx-auto mt-4 max-w-xs text-center text-sm leading-6 text-muted-foreground">Share this illustrative look. Your original photo is not included.</p>
      <div className="mt-6 grid grid-cols-4 gap-2">
        {[{ icon: <MessageCircle />, label: "WhatsApp" }, { icon: <Instagram />, label: "Instagram" }, { icon: <span className="text-base font-bold">f</span>, label: "Facebook" }, { icon: <span className="text-sm font-bold">𝕏</span>, label: "X" }].map((item) => (
          <Button key={item.label} variant="ghost" onClick={nativeShare} className="h-18 flex-col gap-1 rounded-lg bg-surface px-1 text-[10px] [&_svg]:size-5">{item.icon}{item.label}</Button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12 rounded-lg shadow-none" onClick={() => { const a = document.createElement("a"); a.href = look.src; a.download = "my-shoplook.jpg"; a.click(); }}><Download /> Download</Button>
        <Button className="h-12 rounded-lg" onClick={copy}>{copied ? <CheckCircle2 /> : <Copy />}{copied ? "Copied" : "Copy link"}</Button>
      </div>
    </div>
  );
}

function BuySheet({ selected }: { selected: number }) {
  const look = getLook(selected);
  return (
    <div>
      <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-b border-border pb-5">
        <img src={look.src} alt={look.name} className="aspect-square w-full rounded-md object-cover object-bottom" />
        <div className="min-w-0"><span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-semibold text-success"><Check className="size-3" /> Exact item verified</span><p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">North Standard</p><h3 className="font-display text-2xl font-medium">{look.name}</h3><p className="mt-1 text-sm text-muted-foreground">{look.colour}</p></div>
      </div>
      <div className="py-5"><label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your size</label><div className="mt-3 flex gap-2">{["5", "6", "7", "8"].map((size) => <Button key={size} variant={size === "7" ? "default" : "outline"} size="icon" className="h-11 w-11 rounded-full shadow-none">{size}</Button>)}</div></div>
      <div className="border-t border-border pt-5"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div><p className="font-medium">Original retailer</p><p className="mt-1 text-xs text-muted-foreground">Illustrative listing · checked just now</p></div><p className="text-sm font-medium">Price unavailable</p></div><Button className="mt-5 h-12 w-full rounded-lg" onClick={() => window.alert("This is an illustrative retailer handoff. No live listing is connected yet.")}>Open retailer <ExternalLink /></Button><p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">The retailer handles availability, pricing and checkout.</p></div>
    </div>
  );
}

function PoseSheet({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div><div className="rounded-lg bg-primary-soft p-4"><p className="text-xs font-semibold uppercase tracking-widest text-primary">New illustrative version</p><p className="mt-2 font-display text-2xl">Bring one foot forward, keeping the current outfit and setting.</p></div><p className="mt-5 text-sm leading-6 text-muted-foreground">A new pose may vary slightly from the current image. This demo creates a separate version and keeps your original.</p><Button className="mt-6 h-12 w-full rounded-lg" onClick={onConfirm}><Sparkles /> Confirm new version</Button></div>
  );
}