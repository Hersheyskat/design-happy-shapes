import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Expand,
  ImagePlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  Share2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import sampleCoral from "@/assets/shoplook-coral.jpg";
import sampleBlack from "@/assets/shoplook-black.jpg";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShopLook — Compare looks clearly" },
      {
        name: "description",
        content: "Put complete looks side by side, compare the details, and choose your favourite.",
      },
      { property: "og:title", content: "ShopLook — Compare looks clearly" },
      {
        property: "og:description",
        content: "Put complete looks side by side, compare the details, and choose your favourite.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopLook,
});

type View = "start" | "processing" | "compare" | "detail";
type Look = { src: string; name: string; note: string; uploaded: boolean };

const sampleLooks: Look[] = [
  { src: sampleCoral, name: "Look 01", note: "Warm accent · relaxed proportions", uploaded: false },
  { src: sampleBlack, name: "Look 02", note: "Monochrome · sharper finish", uploaded: false },
];

function ShopLook() {
  const [view, setView] = useState<View>("start");
  const [looks, setLooks] = useState<Look[]>([]);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState([1]);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      looks.forEach((look) => {
        if (look.uploaded && look.src.startsWith("blob:")) URL.revokeObjectURL(look.src);
      });
    };
  }, [looks]);

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
    setView("start");
    setLooks([]);
    setSelected(0);
    setZoom([1]);
  };

  const activeLook = looks[selected] ?? looks[0] ?? sampleLooks[0];

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] border-x border-border/70 bg-background shadow-page">
        <AppHeader
          showBack={view === "detail"}
          onBack={() => setView("compare")}
          onReset={reset}
          showReset={view !== "start" && view !== "processing"}
        />
        {view === "start" && (
          <StartView looks={looks} onChange={replaceLook} onCompare={compare} onSamples={() => { setLooks(sampleLooks); setView("compare"); }} />
        )}
        {view === "processing" && <ProcessingView looks={looks} />}
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

function AppHeader({ showBack, showReset, onBack, onReset }: { showBack: boolean; showReset: boolean; onBack: () => void; onReset: () => void }) {
  return (
    <header className="grid h-16 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-border px-3">
      {showBack ? <Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back" className="h-11 w-11 rounded-full"><ArrowLeft /></Button> : <span />}
      <button onClick={onReset} className="font-display text-2xl font-semibold" aria-label="Return to ShopLook start">ShopLook</button>
      {showReset ? <Button variant="ghost" size="icon" onClick={onReset} aria-label="Start over" className="h-11 w-11 rounded-full"><RotateCcw /></Button> : <span />}
    </header>
  );
}

function StartView({ looks, onChange, onCompare, onSamples }: { looks: Look[]; onChange: (slot: number, event: ChangeEvent<HTMLInputElement>) => void; onCompare: () => void; onSamples: () => void }) {
  const ready = Boolean(looks[0] && looks[1]);
  return (
    <section className="px-5 pb-12 pt-10">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">A clearer way to choose</p>
      <h1 className="max-w-sm font-display text-[3.45rem] leading-[0.92] font-medium">Put your looks<br />side by side.</h1>
      <p className="mt-5 max-w-sm text-[15px] leading-6 text-muted-foreground">Add two complete outfit photos. Compare the overall effect, the details, and which look feels most like you.</p>
      <div className="mt-9 grid grid-cols-2 gap-3">
        {[0, 1].map((slot) => (
          <LookUpload key={slot} slot={slot} look={looks[slot]} onChange={(event) => onChange(slot, event)} />
        ))}
      </div>
      <Button className="mt-6 h-13 w-full rounded-lg text-base" disabled={!ready} onClick={onCompare}><Expand /> Compare these looks</Button>
      {!ready && <p className="mt-3 text-center text-xs text-muted-foreground">Add two looks to start comparing</p>}
      <Button variant="ghost" className="mt-2 h-11 w-full text-xs text-muted-foreground" onClick={onSamples}>View a sample comparison</Button>
      <div className="mt-7 flex items-start gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface"><Check className="size-3" /></span>
        <p>Your photos stay on this device. ShopLook compares the images you choose; it does not alter how you look.</p>
      </div>
    </section>
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

function ProcessingView({ looks }: { looks: Look[] }) {
  return (
    <section className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-8 text-center">
      <div className="relative mb-8 flex -space-x-5">
        {looks.slice(0, 2).map((look, index) => <img key={look.src} src={look.src} alt={`Look ${index + 1}`} className="size-24 rounded-full border-4 border-background object-cover" />)}
        <span className="absolute -inset-2 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Looking at both</p>
      <h1 className="mt-3 font-display text-4xl font-medium">Comparing your looks</h1>
      <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">Reading colour, shape, balance, and the overall impression.</p>
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Preparing your comparison</div>
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
    if (navigator.share) await navigator.share({ title: "My ShopLook comparison", text: "Which look would you choose?", url: window.location.href });
    else await copy();
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