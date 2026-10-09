import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogProductDto } from "@/lib/community.types";

export function productBrand(name: string) {
  const brands = ["Symbol Premium", "SMOWKLY", "DEELMO", "INKAST", "AD by Arvind", "BASICS", "Thomas Scott", "FableStreet", "SaintX", "Cottinfab", "U.S. Polo ASSN.", "ROCKSY", "KLOSIA", "Stylum", "Myx", "Calvin Klein", "CK", "Louis Philippe", "USPA", "Levi's", "SHEIN", "Moomaya"];
  const cleaned = name.replace(/^Amazon Brand\s*[-–]\s*/i, "");
  return brands.find((brand) => cleaned.toLowerCase().startsWith(brand.toLowerCase())) ?? "Brand not listed";
}

export function CatalogProductGrid({ products, selectedId, generatingId, onSelect, mode }: {
  products: CatalogProductDto[];
  selectedId?: string;
  generatingId?: string | null;
  onSelect: (product: CatalogProductDto) => void;
  mode: "choose" | "create";
}) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-4" aria-label="Product catalogue">
    {products.map((product) => <Button key={product.id} variant="ghost" aria-label={`${mode === "choose" ? "Choose" : "Try"} ${product.name}`} aria-pressed={selectedId === product.id || generatingId === product.id} aria-disabled={mode === "create" && Boolean(generatingId)} onClick={() => { if (mode === "create" && generatingId) return; onSelect(product); }} className={`h-auto min-w-0 flex-col items-stretch justify-start gap-0 overflow-hidden rounded-md border p-0 text-left ${selectedId === product.id || generatingId === product.id ? "border-primary bg-primary-soft" : "border-border"}`}>
      <span className="relative block aspect-[4/5] w-full overflow-hidden bg-surface"><img src={product.image} alt="" loading="lazy" width={768} height={1024} className="size-full object-contain" />{generatingId === product.id && <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-background text-primary"><LoaderCircle className="size-4 animate-spin" /></span>}</span>
      <span className="block w-full truncate px-2.5 pt-2.5 text-sm font-semibold">{productBrand(product.name)}</span>
      <span className="block w-full truncate px-2.5 pt-0.5 text-xs text-muted-foreground">{product.retailer}</span>
      <span className="block w-full px-2.5 pb-2.5 pt-1 text-sm">₹{product.price.toLocaleString("en-IN")}</span>
    </Button>)}
  </div>;
}