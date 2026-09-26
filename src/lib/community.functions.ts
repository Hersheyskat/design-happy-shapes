import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ProfileDto, SavedLookDto } from "./community.types";
import { styleMoods } from "./community.types";

const colorSchema = z.object({ name: z.string().max(60), hex: z.string().regex(/^#[0-9a-f]{6}$/i), use: z.string().max(240) });
const adjustmentSchema = z.object({ title: z.string().max(100), detail: z.string().max(400) });
const shoppingItemSchema = z.object({ label: z.string().max(100), searchTerm: z.string().max(160), reason: z.string().max(240), destinationUrl: z.string().url().max(2048) });
const saveInput = z.object({
  shopperImagePath: z.string().min(1).max(500),
  productImagePath: z.string().min(1).max(500).nullable(),
  productUrl: z.string().url().max(2048).nullable(),
  mood: z.enum(styleMoods),
  advice: z.object({ headline: z.string().max(120), summary: z.string().max(600), colors: z.array(colorSchema).length(4), adjustments: z.array(adjustmentSchema).length(3), shoppingItems: z.array(shoppingItemSchema).max(4) }),
});

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

async function signedUrl(client: ReturnType<typeof publicClient>, path: string | null) {
  if (!path) return null;
  const { data } = await client.storage.from("shoplook-media").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function readAdvice(row: { headline: string; summary: string; colors: Json; adjustments: Json }, items: Array<{ label: string; search_term: string; destination_url: string; source: string }>) {
  return {
    headline: row.headline,
    summary: row.summary,
    colors: z.array(colorSchema).catch([]).parse(row.colors),
    adjustments: z.array(adjustmentSchema).catch([]).parse(row.adjustments),
    shoppingItems: items.filter((item) => item.source === "suggested").map((item) => ({ label: item.label, searchTerm: item.search_term, reason: "Chosen to complement this look.", destinationUrl: item.destination_url })),
  };
}

export const ensureMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const existing = await context.supabase.from("profiles").select("id, handle, display_name, bio, style_preferences").eq("id", context.userId).maybeSingle();
    if (existing.data) return existing.data;
    const seed = String(context.claims.email ?? "shopper").split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16) || "shopper";
    const handle = `${seed.length >= 3 ? seed : "shopper"}_${context.userId.slice(0, 6)}`;
    const displayName = String(context.claims.user_metadata?.['full_name'] ?? context.claims.email ?? "ShopLook member").slice(0, 60);
    const created = await context.supabase.from("profiles").insert({ id: context.userId, handle, display_name: displayName }).select("id, handle, display_name, bio, style_preferences").single();
    if (created.error) throw new Error(created.error.message);
    return created.data;
  });

export const saveMyLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureProfile(context);
    if (!data.shopperImagePath.startsWith(`${context.userId}/`) || (data.productImagePath && !data.productImagePath.startsWith(`${context.userId}/`))) throw new Error("Invalid image path.");
    const inserted = await context.supabase.from("saved_looks").insert({
      user_id: context.userId, shopper_image_path: data.shopperImagePath, product_image_path: data.productImagePath,
      product_url: data.productUrl, mood: data.mood, headline: data.advice.headline, summary: data.advice.summary,
      colors: data.advice.colors as Json, adjustments: data.advice.adjustments as Json,
    }).select("id").single();
    if (inserted.error) throw new Error(inserted.error.message);
    const rows = [
      ...(data.productUrl ? [{ look_id: inserted.data.id, user_id: context.userId, label: "Original product", search_term: "Original product", destination_url: data.productUrl, source: "submitted", display_order: 0 }] : []),
      ...data.advice.shoppingItems.map((item, index) => ({ look_id: inserted.data.id, user_id: context.userId, label: item.label, search_term: item.searchTerm, destination_url: item.destinationUrl, source: "suggested", display_order: index + 1 })),
    ];
    if (rows.length) {
      const items = await context.supabase.from("saved_items").insert(rows);
      if (items.error) throw new Error(items.error.message);
    }
    return { id: inserted.data.id };
  });

async function ensureProfile(context: { supabase: SupabaseClient<Database>; userId: string; claims: { email?: unknown; user_metadata?: unknown } }) {
  const existing = await context.supabase.from("profiles").select("id").eq("id", context.userId).maybeSingle();
  if (existing.data) return;
  const email = typeof context.claims.email === "string" ? context.claims.email : "shopper";
  const metadata = context.claims.user_metadata;
  const fullName = typeof metadata === "object" && metadata && "full_name" in metadata ? String(metadata.full_name) : email;
  const seed = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16) || "shopper";
  const result = await context.supabase.from("profiles").insert({ id: context.userId, handle: `${seed.length >= 3 ? seed : "shopper"}_${context.userId.slice(0, 6)}`, display_name: fullName.slice(0, 60) });
  if (result.error) throw new Error(result.error.message);
}

export const listMyLooks = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await ensureProfile(context);
  const result = await context.supabase.from("saved_looks").select("*, saved_items(*)").eq("user_id", context.userId).order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return Promise.all(result.data.map(async (row) => {
    const shopperImageUrl = await context.supabase.storage.from("shoplook-media").createSignedUrl(row.shopper_image_path, 3600);
    const productImageUrl = row.product_image_path ? await context.supabase.storage.from("shoplook-media").createSignedUrl(row.product_image_path, 3600) : null;
    return mapLook(row, row.saved_items, { handle: "you", display_name: "You" }, shopperImageUrl.data?.signedUrl ?? "", productImageUrl?.data?.signedUrl ?? null, 0, 0);
  }));
});

export const publishMyLook = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ id: z.string().uuid(), published: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("saved_looks").update({ is_published: data.published, published_at: data.published ? new Date().toISOString() : null }).eq("id", data.id).eq("user_id", context.userId).select("id").single();
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const deleteMyLook = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
  const look = await context.supabase.from("saved_looks").select("shopper_image_path, product_image_path").eq("id", data.id).eq("user_id", context.userId).single();
  if (look.error) throw new Error(look.error.message);
  const paths = [look.data.shopper_image_path, look.data.product_image_path].filter((path): path is string => Boolean(path));
  if (paths.length) await context.supabase.storage.from("shoplook-media").remove(paths);
  const result = await context.supabase.from("saved_looks").delete().eq("id", data.id).eq("user_id", context.userId);
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const listDiscoverLooks = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const result = await client.from("saved_looks").select("*, profiles!saved_looks_user_id_fkey(handle, display_name), saved_items(*), look_likes(count), look_comments(count)").eq("is_published", true).eq("is_removed", false).order("published_at", { ascending: false }).limit(40);
  if (result.error) throw new Error(result.error.message);
  return Promise.all(result.data.map(async (row) => mapLook(row, row.saved_items, row.profiles, (await signedUrl(client, row.shopper_image_path)) ?? "", await signedUrl(client, row.product_image_path), row.look_likes[0]?.count ?? 0, row.look_comments[0]?.count ?? 0)));
});

function mapLook(row: Database["public"]["Tables"]["saved_looks"]["Row"], items: Database["public"]["Tables"]["saved_items"]["Row"][], profile: { handle: string; display_name: string }, shopperImageUrl: string, productImageUrl: string | null, likeCount: number, commentCount: number): SavedLookDto {
  return { id: row.id, userId: row.user_id, handle: profile.handle, displayName: profile.display_name, shopperImageUrl, productImageUrl, productUrl: row.product_url, mood: z.enum(styleMoods).parse(row.mood), advice: readAdvice(row, items), isPublished: row.is_published, createdAt: row.created_at, items: items.map((item) => ({ id: item.id, label: item.label, searchTerm: item.search_term, destinationUrl: item.destination_url, source: item.source === "submitted" ? "submitted" : "suggested" })), likeCount, commentCount };
}

export const getPublicProfile = createServerFn({ method: "GET" }).inputValidator((input) => z.object({ handle: z.string().min(3).max(24) }).parse(input)).handler(async ({ data }) => {
  const client = publicClient();
  const profile = await client.from("profiles").select("id, handle, display_name, bio, style_preferences").eq("handle", data.handle).single();
  if (profile.error) throw new Error("Profile not found.");
  const [looks, followers, following] = await Promise.all([
    client.from("saved_looks").select("id", { count: "exact", head: true }).eq("user_id", profile.data.id).eq("is_published", true).eq("is_removed", false),
    client.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile.data.id),
    client.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profile.data.id),
  ]);
  return { id: profile.data.id, handle: profile.data.handle, displayName: profile.data.display_name, bio: profile.data.bio, stylePreferences: profile.data.style_preferences, publicLookCount: looks.count ?? 0, followerCount: followers.count ?? 0, followingCount: following.count ?? 0 } satisfies ProfileDto;
});

export const toggleLike = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ lookId: z.string().uuid(), liked: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
  await ensureProfile(context);
  const result = data.liked ? await context.supabase.from("look_likes").upsert({ look_id: data.lookId, user_id: context.userId }) : await context.supabase.from("look_likes").delete().eq("look_id", data.lookId).eq("user_id", context.userId);
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const toggleFollow = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ profileId: z.string().uuid(), following: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
  await ensureProfile(context);
  const result = data.following ? await context.supabase.from("follows").upsert({ follower_id: context.userId, following_id: data.profileId }) : await context.supabase.from("follows").delete().eq("follower_id", context.userId).eq("following_id", data.profileId);
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const addComment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ lookId: z.string().uuid(), body: z.string().trim().min(1).max(500) }).parse(input)).handler(async ({ data, context }) => {
  await ensureProfile(context);
  const result = await context.supabase.from("look_comments").insert({ look_id: data.lookId, user_id: context.userId, body: data.body });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const reportLook = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ lookId: z.string().uuid(), reason: z.enum(["spam", "harassment", "unsafe", "misleading", "other"]) }).parse(input)).handler(async ({ data, context }) => {
  await ensureProfile(context);
  const result = await context.supabase.from("community_reports").insert({ reporter_id: context.userId, look_id: data.lookId, reason: data.reason });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});