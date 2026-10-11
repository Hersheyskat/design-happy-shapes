import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, Expand, Heart, LoaderCircle, Search, Share2, ShoppingBag, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { CatalogProductDto } from "@/lib/community.types";
import { StylistChat } from "@/components/stylist-chat";

type Props = {
  product: CatalogProductDto;
  products: CatalogProductDto[];
  image: ReactNode;
  imageUrl: string;
  completed: boolean;
  generating: string | null;
  saving: boolean;
  sharing?: boolean;
  selected: boolean;
  canSave: boolean;
  comment?: string | undefined;
  commentLoading: boolean;
  commentError?: string | undefined;
  generationError: string;
  comparisonCount: number;
  brand: (name: string) => string;
  onShare: () => void;
  onSave: () => void;
  onBuy: () => void;
  onSelect: (id: string) => void;
  onCompare: () => void;
};

export function ShopLookResult(props: Props) {
  const imageRef = useRef<HTMLDivElement>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stylistOpen, setStylistOpen] = useState(false);
  const [stylistPinned, setStylistPinned] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const stylistAvailable = props.completed && !props.generating && Boolean(props.comment || props.commentLoading || props.commentError);
  const stylistKey = stylistAvailable ? `${props.product.id}:${props.imageUrl}:${props.comment ?? ""}:${props.commentLoading ? "loading" : props.commentError ? "error" : "ready"}` : "";
  useEffect(() => {
    setStylistPinned(false);
    setStylistOpen(Boolean(stylistKey));
    if (!stylistKey || props.commentLoading) return;
    const timer = window.setTimeout(() => setStylistOpen(false), 3000);
    return () => window.clearTimeout(timer);
  }, [stylistKey, props.commentLoading]);
  const normalize = (value: string) => value.toLowerCase().replace(/t[\s-]*shirts?\b/g, "tshirt").replace(/\bshirts\b/g, "shirt").replace(/\bjackets\b/g, "jacket").replace(/\bdresses\b/g, "dress").replace(/\bjeans\b/g, "jean");
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  const matchingProducts = props.products.filter((item) => {
    const text = normalize(`${item.name} ${item.category} ${item.retailer}`);
    return terms.every((term) => text.includes(term));
  });
  const { product, completed, generating, selected, saving } = props;
  const sharing = Boolean(props.sharing);
  const showCompare = saving || props.comparisonCount > 0;
  return <section className="bg-card pb-8 text-foreground">
    <div ref={imageRef} className="relative scroll-mt-16">
      {props.image}
      <Button variant="ghost" className="absolute inset-0 h-full w-full rounded-none p-0 hover:bg-transparent" aria-label="View your look full-screen" onClick={() => setImageOpen(true)}>
        <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-overlay text-overlay-foreground"><Expand /></span>
      </Button>
      <Button variant="ghost" size="icon" className={`absolute right-3 z-10 size-9 rounded-full bg-overlay text-overlay-foreground hover:bg-overlay hover:text-overlay-foreground ${generating ? "top-14" : "top-3"}`} aria-label="Share your look" title="Share your look" disabled={!completed || sharing} onClick={props.onShare}>{sharing ? <LoaderCircle className="size-4 animate-spin" /> : <Share2 className="size-4" />}</Button>
      {generating && <div role="status" className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-overlay px-5 py-3 text-sm text-overlay-foreground"><LoaderCircle className="size-4 animate-spin" /> Creating Your ShopLook…</div>}
      {stylistKey && <>
        <div id="shoplook-stylist-take" aria-live="polite" className={`absolute inset-x-3 bottom-14 z-10 origin-bottom-right rounded-md border border-border bg-card/95 p-3 text-card-foreground shadow-float backdrop-blur-sm motion-safe:transition-all motion-safe:duration-300 ${stylistOpen || stylistPinned ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none translate-y-2 opacity-0"}`}>
          <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h2 className="flex min-w-0 items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="size-4 shrink-0" /> Stylist’s take</h2><Button variant="ghost" size="icon" className="size-7" aria-label="Close stylist’s take" onClick={() => { setStylistOpen(false); setStylistPinned(false); }}><X className="size-3" /></Button></div>
          {props.commentLoading && !props.comment ? <p className="flex items-center gap-2 text-sm leading-5 text-muted-foreground"><LoaderCircle className="size-3.5 shrink-0 animate-spin" /> Reviewing your look…</p> : <p className="text-sm leading-5">{props.comment ?? props.commentError}</p>}
          {Boolean(props.comment) && <Button variant="link" className="mt-1 h-7 px-0 text-xs" onClick={() => { setStylistPinned(true); setChatOpen(true); }}>Ask your stylist <ArrowRight className="size-3" /></Button>}
        </div>
        {!(stylistOpen || stylistPinned) && <Button variant="ghost" size="icon" className="absolute bottom-14 right-3 z-10 size-9 rounded-full bg-overlay text-overlay-foreground hover:bg-overlay hover:text-overlay-foreground" aria-label="Read stylist’s take" title="Stylist’s take" aria-controls="shoplook-stylist-take" aria-expanded={false} onClick={() => setStylistPinned(true)}><Sparkles className="size-4" /></Button>}
      </>}
    </div>

    <div className="px-5 py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0"><h1 className="truncate text-sm font-semibold leading-5" title={product.name}>{props.brand(product.name)}</h1><p className="text-[11px] leading-4 text-muted-foreground">{product.retailer}</p></div>
        <p className="shrink-0 text-sm font-semibold leading-5 text-primary">₹{product.price.toLocaleString("en-IN")}</p>
      </div>
      <div className={`mt-2 grid gap-2 ${showCompare ? "grid-cols-3" : "grid-cols-2"}`}>
        <Button variant="outline" className={`h-9 px-2 text-xs ${selected ? "border-primary bg-primary-soft text-primary" : ""}`} disabled={(!props.canSave && !selected) || saving} aria-label={selected ? `Remove ${product.name} from comparison` : `Save ${product.name} to my looks`} aria-pressed={selected} onClick={props.onSave}>{saving ? <LoaderCircle className="animate-spin" /> : <Heart className={selected ? "fill-primary" : ""} />}{saving ? "Saving" : selected ? "Saved" : "Save"}</Button>
        {showCompare && <Button variant="outline" className="h-9 px-2 text-xs" aria-label={`Compare my looks (${props.comparisonCount})`} disabled={props.comparisonCount === 0} onClick={props.onCompare}>Compare{props.comparisonCount > 0 ? ` (${props.comparisonCount})` : ""} <ArrowRight /></Button>}
        <Button className="h-9 px-2 text-xs" onClick={props.onBuy}><ShoppingBag /> {product.productUrl ? "Buy" : "Search"}</Button>
      </div>
    </div>

    {props.generationError && <p role="alert" className="px-5 pb-3 text-xs text-destructive">{props.generationError} Tap the product again to retry.</p>}

    <section className="border-t border-border pt-3" aria-labelledby="try-another-heading">
      <div className="flex items-center justify-between px-5"><h2 id="try-another-heading" className="font-display text-lg">Try another look</h2></div>
      <div className="mt-2 px-5">
        <label htmlFor="look-clothing-search" className="sr-only">Search clothing</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="look-clothing-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Shirts, jackets, dresses…" className="h-10 bg-background pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none" />
          {search && <Button variant="ghost" size="icon" className="absolute right-0 top-0 size-10" aria-label="Clear clothing search" title="Clear search" onClick={() => setSearch("")}><X className="size-4" /></Button>}
        </div>
        {search.trim() && <p role="status" className="mt-2 text-xs text-muted-foreground">{matchingProducts.length ? `${matchingProducts.length} ${matchingProducts.length === 1 ? "match" : "matches"}` : "No matching clothing. Try a different search."}</p>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 px-5 pb-5" aria-label="Products to try on">
        {matchingProducts.map((item) => <Button key={item.id} variant="ghost" disabled={Boolean(generating)} aria-label={`Try ${item.name} on me`} aria-pressed={product.id === item.id} onClick={() => {
          props.onSelect(item.id);
          imageRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
        }} className="h-auto min-w-0 w-full flex-col items-stretch justify-start gap-0 whitespace-normal rounded-none p-0 text-left hover:bg-transparent disabled:opacity-70">
          <span className={`relative block aspect-[3/4] w-full shrink-0 overflow-hidden rounded-md border bg-surface ${product.id === item.id || generating === item.id ? "border-primary" : "border-border"}`}><img src={item.image} alt="" loading="lazy" width={300} height={400} className="size-full object-contain transition-transform motion-safe:hover:scale-105" />{(product.id === item.id || generating === item.id) && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">{generating === item.id ? <LoaderCircle className="size-3 animate-spin" /> : <Check className="size-3" />}</span>}<span className="absolute inset-x-2 bottom-2 flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-2 text-xs font-semibold text-background">{generating === item.id ? <><LoaderCircle className="size-3 animate-spin" /> Creating…</> : <>Try this on <Sparkles className="size-3" /></>}</span></span>
          <span className="w-full truncate pt-2 text-sm font-semibold">{props.brand(item.name)}</span>
          <span className="w-full truncate pt-0.5 text-[11px] text-muted-foreground">{item.retailer}</span>
          <span className="w-full pt-1 text-sm font-semibold">₹{item.price.toLocaleString("en-IN")}</span>
        </Button>)}
      </div>
    </section>


    <StylistChat
      open={chatOpen}
      onOpenChange={setChatOpen}
      sessionLook={
        completed && props.imageUrl
          ? {
              productName: product.name,
              comment: props.comment ?? "",
              imageUrl: props.imageUrl,
            }
          : null
      }
    />
    <Dialog open={imageOpen} onOpenChange={setImageOpen}>
      <DialogContent aria-describedby={undefined} className="h-dvh max-h-dvh w-full max-w-[430px] min-h-0 overflow-hidden gap-0 rounded-none border-0 bg-card p-2 sm:rounded-none [&>button]:z-10 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-background [&>button]:opacity-100">
        <DialogTitle className="sr-only">Your ShopLook full-screen</DialogTitle>
        <img src={props.imageUrl} alt={completed ? `Your ShopLook wearing ${product.name}` : "Your original photo"} className="h-full min-h-0 max-h-[calc(100dvh-1rem)] w-full min-w-0 object-contain" />
      </DialogContent>
    </Dialog>
  </section>;
}