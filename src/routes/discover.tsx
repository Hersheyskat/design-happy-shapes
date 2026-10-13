import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ShopLookShell } from "@/components/shoplook-shell";
import { brandFilterOptions } from "@/lib/brands";
import { listCatalogProducts } from "@/lib/community.functions";
import type { CatalogProductDto } from "@/lib/community.types";

export const Route = createFileRoute("/discover")({
  head: () => ({ meta: [{ title: "Shop clothing — ShopLook" }, { name: "description", content: "Browse ShopLook's men's and women's catalogue and send any product to your Look studio." }, { property: "og:title", content: "Shop clothing — ShopLook" }, { property: "og:description", content: "Browse clothing and send any product to your Look studio." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ShopPage,
});

function ShopPage() {
  const loadCatalog = useServerFn(listCatalogProducts);
  const [products, setProducts] = useState<CatalogProductDto[]>([]);
  const [audience, setAudience] = useState<"women" | "men">("women");
  const [category, setCategory] = useState("All");
  const [retailer, setRetailer] = useState("All");
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftAudience, setDraftAudience] = useState<"women" | "men">("women");
  const [draftRetailer, setDraftRetailer] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCatalog().then(setProducts).catch(() => setError("The catalogue is unavailable. Please try again.")).finally(() => setLoading(false));
  }, [loadCatalog]);

  const audienceProducts = products.filter((product) => product.audience === audience);
  const draftRetailers = ["All", ...brandFilterOptions(products.filter((product) => product.audience === draftAudience).map((product) => product.retailer), draftAudience)];
  const term = query.trim().toLowerCase();
  const scopedProducts = audienceProducts.filter((product) => {
    if (retailer !== "All" && product.retailer !== retailer) return false;
    return !term || `${product.name} ${product.retailer} ${product.category} ${product.subcategory ?? ""}`.toLowerCase().includes(term);
  });
  const categories = ["All", ...Array.from(new Set(scopedProducts.map((product) => product.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const activeCategory = category !== "All" && !categories.includes(category) ? "All" : category;
  const filtered = scopedProducts.filter((product) => activeCategory === "All" || product.category === activeCategory);
  const filterCount = (retailer !== "All" ? 1 : 0);
  useEffect(() => {
    if (category !== activeCategory) setCategory(activeCategory);
  }, [category, activeCategory]);

  return <ShopLookShell>
    <header className="border-b border-border px-5 pb-5 pt-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">ShopLook catalogue</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl">Shop</h1>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground" onClick={() => { setDraftAudience(audience); setDraftRetailer(retailer); setFilterOpen(true); }}>
          <SlidersHorizontal className="size-3.5" />
          Filter{filterCount > 0 ? ` · ${filterCount}` : ""}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Choose a piece to place it first in your Look studio.</p>
    </header>
    <section className="px-4 pb-10 pt-4">
      <label className="flex h-11 items-center gap-3 rounded-md bg-surface px-3 focus-within:ring-1 focus-within:ring-ring">
        <Search className="size-4 text-muted-foreground" />
        <span className="sr-only">Search products</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search shirts, brands…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none" />
        {query ? <button type="button" aria-label="Clear search" className="text-muted-foreground" onClick={() => setQuery("")}><X className="size-4" /></button> : null}
      </label>

      <div className="mt-5 flex gap-5 overflow-x-auto border-b border-border" role="tablist" aria-label="Catalogue">
        {(["women", "men"] as const).map((option) => {
          const active = audience === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              className={`shrink-0 border-b-2 pb-2.5 text-sm capitalize transition-colors ${active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => { setAudience(option); setCategory("All"); setRetailer("All"); }}
            >
              {option === "women" ? "Women" : "Men"}
            </button>
          );
        })}
      </div>

      {categories.length > 1 && (
        <div className="mt-4 flex gap-5 overflow-x-auto border-b border-border" role="tablist" aria-label="Category">
          {categories.map((option) => {
            const active = activeCategory === option;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active}
                className={`shrink-0 border-b-2 pb-2.5 text-sm transition-colors ${active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground"}`}
                onClick={() => setCategory(option)}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {loading && <p role="status" className="py-16 text-center text-sm text-muted-foreground">Loading products…</p>}
      {error && <p role="alert" className="py-16 text-center text-sm text-destructive">{error}</p>}
      {!loading && !error && products.length === 0 && <div className="py-20 text-center"><h2 className="font-display text-2xl">Catalogue is empty</h2><p className="mt-2 text-sm text-muted-foreground">Products will appear here after they are added to Supabase.</p></div>}
      {!loading && !error && filtered.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {filtered.map((product) => (
            <Button key={product.id} asChild variant="ghost" className="h-auto min-w-0 flex-col items-stretch justify-start gap-0 overflow-hidden rounded-md p-0 text-left hover:bg-transparent">
              <Link to="/" search={{ product: product.id }} aria-label={`Try ${product.name} in Look`}>
                <span className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
                  <img src={product.image} alt={product.name} loading="lazy" width={768} height={1024} className="size-full object-contain" />
                  <span className="pointer-events-none absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-medium leading-none text-white">
                    Try this on
                    <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                  </span>
                </span>
                <span className="block w-full truncate pt-3 text-sm font-semibold">{product.name}</span>
                <span className="block w-full truncate pt-1 text-xs text-muted-foreground">{product.retailer}</span>
                <span className="block w-full pt-1 text-sm">₹{product.price.toLocaleString("en-IN")}</span>
              </Link>
            </Button>
          ))}
        </div>
      )}
      {!loading && !error && products.length > 0 && filtered.length === 0 && <div className="py-20 text-center"><h2 className="font-display text-2xl">No products found</h2><p className="mt-2 text-sm text-muted-foreground">Try another search or clear filters.</p></div>}
    </section>

    <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
      <DrawerContent className="mx-auto max-h-[85dvh] max-w-[430px] overflow-hidden">
        <DrawerHeader className="shrink-0 text-left">
          <DrawerTitle>Filter shop</DrawerTitle>
          <DrawerDescription>Brand and catalogue live here so the grid stays clean.</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-6 px-4 pb-2">
          <div className="shrink-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catalogue</p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Catalogue">
              {(["women", "men"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={draftAudience === option}
                  className={`h-10 rounded-md border text-sm capitalize transition-colors ${draftAudience === option ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground"}`}
                  onClick={() => { setDraftAudience(option); setDraftRetailer("All"); }}
                >
                  {option === "women" ? "Women" : "Men"}
                </button>
              ))}
            </div>
          </div>
          {draftRetailers.length > 1 && (
            <div className="flex min-h-0 flex-1 flex-col">
              <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">Brand</p>
              <div className="mt-3 min-h-0 max-h-[36vh] flex-1 overflow-y-auto overscroll-contain pr-1" role="group" aria-label="Brand">
                <div className="flex flex-wrap gap-2">
                  {draftRetailers.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={draftRetailer === option}
                      className={`h-9 rounded-md border px-3 text-sm transition-colors ${draftRetailer === option ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground"}`}
                      onClick={() => setDraftRetailer(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <DrawerFooter className="shrink-0 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => { setDraftAudience("women"); setDraftRetailer("All"); }}>Clear</Button>
          <DrawerClose asChild>
            <Button type="button" onClick={() => { setAudience(draftAudience); setRetailer(draftRetailer); setCategory("All"); setFilterOpen(false); }}>Show products</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </ShopLookShell>;
}
