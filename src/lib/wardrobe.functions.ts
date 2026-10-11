import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wardrobeCategories } from "./wardrobe.types";
import { suggestWardrobeOutfits } from "./wardrobe-ai.server";

export const listWardrobe = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const result = await context.supabase.from("wardrobe_items").select("id,name,category,image_path").eq("user_id", context.userId).order("created_at", { ascending: false });
  if (result.error) throw new Error("Could not load your wardrobe.");
  return result.data;
});
export const addWardrobeItems = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.array(z.object({ name: z.string().trim().min(1).max(100), category: z.enum(wardrobeCategories), imagePath: z.string().max(500) })).min(1).max(10).parse(input)).handler(async ({ data, context }) => {
  for (const item of data) {
    if (!item.imagePath.startsWith(`${context.userId}/wardrobe/`) || item.imagePath.includes("..")) throw new Error("Invalid wardrobe photo.");
    const photo = await context.supabase.storage.from("shoplook-media").download(item.imagePath);
    if (photo.error || !photo.data || photo.data.size > 5_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(photo.data.type)) throw new Error("Upload a valid clothing photo first.");
  }
  const result = await context.supabase.from("wardrobe_items").insert(data.map((item) => ({ user_id: context.userId, name: item.name, category: item.category, image_path: item.imagePath })));
  if (result.error) throw new Error("Could not keep these clothes in your wardrobe.");
  return { ok: true };
});
export const removeWardrobeItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
  const item = await context.supabase.from("wardrobe_items").select("image_path").eq("id", data.id).eq("user_id", context.userId).single();
  if (item.error) throw new Error("Wardrobe piece not found.");
  const removed = await context.supabase.storage.from("shoplook-media").remove([item.data.image_path]);
  if (removed.error) throw new Error("Could not remove the clothing photo.");
  const result = await context.supabase.from("wardrobe_items").delete().eq("id", data.id).eq("user_id", context.userId);
  if (result.error) throw new Error("Could not remove this wardrobe piece.");
  return { ok: true };
});
export const suggestWardrobe = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).min(1).max(12), occasion: z.string().trim().min(1).max(160), preferences: z.string().max(280) }).parse(input)).handler(async ({ data, context }) => {
  const items = await context.supabase.from("wardrobe_items").select("id,name,category,image_path").eq("user_id", context.userId).in("id", data.ids);
  if (items.error || items.data.length !== new Set(data.ids).size) throw new Error("Some wardrobe pieces are no longer available.");
  return suggestWardrobeOutfits(context.supabase, items.data, data.occasion, data.preferences);
});