import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShopLookShell } from "@/components/shoplook-shell";
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadCatalog().then(setProducts).catch(() => setError("The catalogue is unavailable. Please try again.")).finally(() => setLoading(false));
  }, [loadCatalog]);

  const term = query.trim().toLowerCase();
  const filtered = products.filter((product) => product.audience === audience && (!term || `${product.name} ${product.retailer} ${product.category}`.toLowerCase().includes(term)));
  const count = products.filter((product) => product.audience === audience).length;

  return <ShopLookShell>
    <header className="border-b border-border px-5 pb-5 pt-7"><p className="text-xs font-semibold uppercase tracking-widest text-primary">ShopLook catalogue</p><h1 className="mt-2 font-display text-4xl">Shop</h1><p className="mt-2 text-sm text-muted-foreground">Choose a piece to place it first in your Look studio.</p></header>
    <section className="px-4 pb-10 pt-4">
      <label className="flex h-11 items-center gap-3 rounded-md border border-input bg-background px-3 focus-within:ring-1 focus-within:ring-ring"><Search className="size-4 text-muted-foreground" /><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search products, brands or categories" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
      <div className="mt-4 flex items-center gap-2" role="group" aria-label="Shop catalogue"><Button type="button" aria-pressed={audience === "women"} variant={audience === "women" ? "default" : "outline"} onClick={() => setAudience("women")}>Women</Button><Button type="button" aria-pressed={audience === "men"} variant={audience === "men" ? "default" : "outline"} onClick={() => setAudience("men")}>Men</Button><span className="ml-auto text-xs text-muted-foreground">{count} products</span></div>
      {loading && <p role="status" className="py-16 text-center text-sm text-muted-foreground">Loading products…</p>}
      {error && <p role="alert" className="py-16 text-center text-sm text-destructive">{error}</p>}
      {!loading && !error && products.length === 0 && <div className="py-20 text-center"><h2 className="font-display text-2xl">Catalogue is empty</h2><p className="mt-2 text-sm text-muted-foreground">Products will appear here after they are added to Supabase.</p></div>}
      {!loading && !error && filtered.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3">{filtered.map((product) => <Button key={product.id} asChild variant="ghost" className="h-auto min-w-0 flex-col items-stretch justify-start gap-0 overflow-hidden rounded-md border border-border p-0 text-left"><Link to="/" search={{ product: product.id }} aria-label={`Try ${product.name} in Look`}><span className="aspect-[4/5] w-full overflow-hidden bg-surface"><img src={product.image} alt={product.name} loading="lazy" width={768} height={1024} className="size-full object-contain" /></span><span className="block w-full truncate px-3 pt-3 text-sm font-semibold">{product.name}</span><span className="block w-full truncate px-3 pt-1 text-xs text-muted-foreground">{product.retailer}</span><span className="block w-full px-3 pb-3 pt-1 text-sm">₹{product.price.toLocaleString("en-IN")}</span></Link></Button>)}</div>}
      {!loading && !error && products.length > 0 && filtered.length === 0 && <div className="py-20 text-center"><h2 className="font-display text-2xl">No products found</h2><p className="mt-2 text-sm text-muted-foreground">Try another search or catalogue.</p></div>}
    </section>
  </ShopLookShell>;
}