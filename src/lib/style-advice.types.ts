export type StyleAdvice = {
  headline: string;
  summary: string;
  colors: Array<{ name: string; hex: string; use: string }>;
  adjustments: Array<{ title: string; detail: string }>;
  shoppingItems: Array<{ label: string; searchTerm: string; reason: string; destinationUrl: string }>;
};