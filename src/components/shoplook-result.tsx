import { useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, Expand, Heart, LoaderCircle, Share2, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { CatalogProductDto } from "@/lib/community.types";

type Props = {
  product: CatalogProductDto;
  products: CatalogProductDto[];
  image: ReactNode;
  imageUrl: string;
  completed: boolean;
  generating: string | null;
  saving: boolean;
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
  const [imageOpen, setImageOpen] = useState(false);
  const { product, completed, generating, selected, saving } = props;
  return <section className="bg-card pb-8 text-foreground">
    <div className="relative">
      {props.image}
      <Button variant="ghost" className="absolute inset-0 h-full w-full rounded-none p-0 hover:bg-transparent" aria-label="View your look full-screen" onClick={() => setImageOpen(true)}>
        <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-overlay text-overlay-foreground"><Expand /></span>
      </Button>
      {generating && <div role="status" className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-overlay px-5 py-3 text-sm text-overlay-foreground"><LoaderCircle className="size-4 animate-spin" /> Creating your ShopLook…</div>}
    </div>

    <div className="px-5 py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0"><h1 className="truncate text-sm font-semibold leading-5" title={product.name}>{props.brand(product.name)}</h1><p className="text-[11px] leading-4 text-muted-foreground">{product.retailer}</p></div>
        <p className="shrink-0 text-sm font-semibold leading-5 text-primary">₹{product.price.toLocaleString("en-IN")}</p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-9 px-2 text-xs" disabled={!completed} onClick={props.onShare}><Share2 /> Share</Button>
        <Button variant="outline" className={`h-9 px-2 text-xs ${selected ? "border-primary bg-primary-soft text-primary" : ""}`} disabled={!props.canSave || saving} aria-label={selected ? `Remove ${product.name} from comparison` : `Save ${product.name} to my looks`} aria-pressed={selected} onClick={props.onSave}>{saving ? <LoaderCircle className="animate-spin" /> : <Heart className={selected ? "fill-primary" : ""} />}{saving ? "Saving" : selected ? "Saved" : "Save"}</Button>
        <Button className="h-9 px-2 text-xs" onClick={props.onBuy}><ShoppingBag /> {product.productUrl ? "Buy" : "Search"}</Button>
      </div>
    </div>

    {props.generationError && <p role="alert" className="px-5 pb-3 text-xs text-destructive">{props.generationError} Tap the product again to retry.</p>}

    <section className="border-t border-border pt-4" aria-labelledby="try-another-heading">
      <div className="flex items-center justify-between px-5"><h2 id="try-another-heading" className="font-display text-2xl">Try another look</h2><ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" /></div>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-4 scrollbar-none" aria-label="Products to try on">
        {props.products.map((item) => <Button key={item.id} variant="ghost" disabled={Boolean(generating)} aria-label={`Try ${item.name} on me`} aria-pressed={product.id === item.id} onClick={() => props.onSelect(item.id)} className={`h-auto w-[110px] shrink-0 snap-start flex-col items-stretch gap-0 overflow-hidden rounded-md border p-0 text-left hover:bg-secondary ${product.id === item.id || generating === item.id ? "border-primary" : "border-border"}`}>
          <span className="relative block h-[108px] w-full shrink-0 overflow-hidden bg-surface"><img src={item.image} alt="" loading="lazy" width={240} height={240} className="size-full object-contain" />{product.id === item.id && <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}</span>
          <span className="flex w-full items-center justify-between px-2 py-2 text-xs font-semibold text-primary">Try this on <ArrowRight className="size-3" /></span>
          <span className="w-full truncate px-2 text-xs font-medium">{props.brand(item.name)}</span>
          <span className="w-full px-2 pb-2 pt-1 text-[11px] text-muted-foreground">₹{item.price.toLocaleString("en-IN")}</span>
        </Button>)}
      </div>
    </section>

    {completed && <details className="group mx-5 border-y border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-4 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden"><Sparkles className="size-4" /> Stylist's take <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" /></summary>
      <div className="pb-4">{props.commentLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Reviewing your look…</p> : props.comment ? <p className="text-sm leading-6">{props.comment}</p> : props.commentError ? <p role="alert" className="text-sm text-muted-foreground">{props.commentError}</p> : null}</div>
    </details>}
    <div className="px-5 pt-5"><Button variant="outline" className="h-11 w-full" disabled={props.comparisonCount === 0} onClick={props.onCompare}>Compare my looks ({props.comparisonCount}) <ArrowRight /></Button></div>

    <Dialog open={imageOpen} onOpenChange={setImageOpen}>
      <DialogContent aria-describedby={undefined} className="h-dvh max-h-dvh w-full max-w-[430px] min-h-0 overflow-hidden gap-0 rounded-none border-0 bg-card p-2 sm:rounded-none [&>button]:z-10 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-background [&>button]:opacity-100">
        <DialogTitle className="sr-only">Your ShopLook full-screen</DialogTitle>
        <img src={props.imageUrl} alt={completed ? `Your ShopLook wearing ${product.name}` : "Your original photo"} className="h-full min-h-0 max-h-[calc(100dvh-1rem)] w-full min-w-0 object-contain" />
      </DialogContent>
    </Dialog>
  </section>;
}