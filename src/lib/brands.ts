const STORE_HOST_LABELS: Record<string, string> = {
  "myntra.com": "Myntra",
  "ajio.com": "AJIO",
  "amazon.in": "Amazon India",
  "amzn.in": "Amazon India",
  "amazon.com": "Amazon",
  "flipkart.com": "Flipkart",
  "nykaafashion.com": "Nykaa Fashion",
  "tatacliq.com": "Tata CLiQ",
  "reliancetrends.com": "Reliance Trends",
  "fablestreet.com": "FableStreet",
};

/** E-commerce store label from a catalogue product URL (not brand/retailer). */
export function storeLabelFromUrl(url: string | null | undefined) {
  if (!url?.trim()) return "";
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    if (STORE_HOST_LABELS[host]) return STORE_HOST_LABELS[host];
    const leaf = host.split(".")[0]?.trim();
    if (!leaf) return "";
    return leaf.charAt(0).toUpperCase() + leaf.slice(1);
  } catch {
    return "";
  }
}

/** Curated brand display order for shopper Brand filters (matches admin allowlist). */

export const WOMEN_BRAND_ORDER = [
  "FableStreet",
  "Fabindia",
  "Biba",
  "W for Woman",
  "Aurelia",
  "Global Desi",
  "Libas",
  "Soch",
  "Manyavar & Mohey",
  "House of Indya",
  "Anita Dongre",
  "Louis Vuitton",
  "Chanel",
  "Dior",
  "Gucci",
  "Hermès",
  "Prada",
  "Saint Laurent",
  "Ralph Lauren",
  "Michael Kors",
  "Balenciaga",
  "Uniqlo",
  "H&M",
  "Forever New",
  "Pretty Pixie",
  "Levi's",
  "Tommy Hilfiger",
  "Calvin Klein",
] as const;

export const MEN_BRAND_ORDER = [
  "Snitch",
  "Calvin Klein",
  "Manyavar",
  "Fabindia",
  "Rare Rabbit",
  "Allen Solly",
  "Louis Philippe",
  "Van Heusen",
  "Peter England",
  "Raymond",
  "House of Pataudi",
  "Bewakoof",
  "Roadster",
  "Mast & Harbour",
  "Uniqlo",
  "H&M",
  "Levi's",
  "Tommy Hilfiger",
  "U.S. Polo Assn.",
  "Jack & Jones",
  "Louis Vuitton",
  "Gucci",
  "Prada",
  "Saint Laurent",
  "Balenciaga",
] as const;

export function sortBrandNames(names: string[], audience: "women" | "men"): string[] {
  const order = audience === "women" ? WOMEN_BRAND_ORDER : MEN_BRAND_ORDER;
  const rank = new Map(order.map((name, index) => [name.toLowerCase(), index]));
  return [...names].sort((a, b) => {
    const ra = rank.get(a.toLowerCase());
    const rb = rank.get(b.toLowerCase());
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.localeCompare(b);
  });
}

/** Women category tabs: Dresses and Tops first, then alphabetical. */
const WOMEN_CATEGORY_ORDER = ["Dresses", "Tops"] as const;

/** Men category tabs: Shirts and T-shirts first, then alphabetical. */
const MEN_CATEGORY_ORDER = ["Shirts", "T-shirts"] as const;

export function sortCategoryNames(names: string[], audience: "women" | "men"): string[] {
  const preferred = audience === "women" ? WOMEN_CATEGORY_ORDER : MEN_CATEGORY_ORDER;
  const rank = new Map(preferred.map((name, index) => [name.toLowerCase(), index]));
  return [...names].sort((a, b) => {
    const ra = rank.get(a.toLowerCase());
    const rb = rank.get(b.toLowerCase());
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Catalogue grids: preferred categories first (Dresses for women, Shirts for men),
 * then curated brand order within a category.
 */
export function sortProductsByBrand<T extends { retailer: string; category?: string | null }>(
  products: T[],
  audience: "women" | "men",
): T[] {
  const categoryPreferred = audience === "women" ? WOMEN_CATEGORY_ORDER : MEN_CATEGORY_ORDER;
  const categoryRank = new Map(categoryPreferred.map((name, index) => [name.toLowerCase(), index]));
  const brandOrder = audience === "women" ? WOMEN_BRAND_ORDER : MEN_BRAND_ORDER;
  const brandRank = new Map(brandOrder.map((name, index) => [name.toLowerCase(), index]));

  const categoryScore = (category: string | null | undefined) => {
    const rank = categoryRank.get((category ?? "").toLowerCase());
    return rank != null ? rank : categoryPreferred.length;
  };

  return [...products].sort((a, b) => {
    const categoryDiff = categoryScore(a.category) - categoryScore(b.category);
    if (categoryDiff !== 0) return categoryDiff;

    const ra = brandRank.get(a.retailer.toLowerCase());
    const rb = brandRank.get(b.retailer.toLowerCase());
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.retailer.localeCompare(b.retailer);
  });
}

/**
 * Brand chips for the shopper filter: every retailer that currently has
 * available catalogue products for the audience, sorted by curated order.
 * Prefer canonical allowlist spelling so chips stay consistent.
 */
export function brandFilterOptions(
  names: string[],
  audience: "women" | "men",
): string[] {
  const order = audience === "women" ? WOMEN_BRAND_ORDER : MEN_BRAND_ORDER;
  const canonical = new Map(order.map((name) => [name.toLowerCase(), name]));
  const present = new Map<string, string>();

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (present.has(key)) continue;
    present.set(key, canonical.get(key) ?? trimmed);
  }

  return sortBrandNames(Array.from(present.values()), audience);
}
