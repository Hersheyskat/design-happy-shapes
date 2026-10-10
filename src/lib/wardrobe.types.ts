import { z } from "zod";

export const wardrobeCategories = ["Tops", "Bottoms", "Dresses", "Layers", "Shoes", "Accessories", "Other"] as const;
export const outfitSchema = z.object({
  title: z.string(),
  reason: z.string(),
  styling: z.string(),
  wardrobeIds: z.array(z.string()),
  missing: z.array(z.object({ label: z.string(), reason: z.string(), searchTerm: z.string(), catalogProductId: z.string().nullable() })),
});
export const outfitPlanSchema = z.object({ outfits: z.array(outfitSchema) });
export type WardrobeOutfit = z.infer<typeof outfitSchema>;
export type WardrobeItem = { id: string; name: string; category: string; image_path: string; imageUrl?: string };