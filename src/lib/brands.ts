/** Curated brand display order for shopper Brand filters (matches admin allowlist). */

export const WOMEN_BRAND_ORDER = [
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
  "Balenciaga",
  "Uniqlo",
  "H&M",
  "Levi's",
  "Tommy Hilfiger",
  "Calvin Klein",
] as const;

export const MEN_BRAND_ORDER = [
  "Manyavar",
  "Fabindia",
  "Snitch",
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
  "Ralph Lauren",
  "Calvin Klein",
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

/**
 * Brand chips for the shopper filter: curated allowlist only, in client order,
 * capped so the drawer stays short (default top 10 that actually have products).
 * Prefer canonical allowlist spelling so chips stay consistent.
 */
export function brandFilterOptions(
  names: string[],
  audience: "women" | "men",
  limit = 10,
): string[] {
  const order = audience === "women" ? WOMEN_BRAND_ORDER : MEN_BRAND_ORDER;
  const present = new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const options: string[] = [];
  for (const brand of order) {
    if (!present.has(brand.toLowerCase())) continue;
    options.push(brand);
    if (options.length >= limit) break;
  }
  return options;
}
