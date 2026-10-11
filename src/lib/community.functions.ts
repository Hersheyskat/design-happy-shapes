import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { CatalogProductDto, ProfileDto, SavedLookDto } from "./community.types";
import { styleMoods } from "./community.types";

const colorSchema = z.object({ name: z.string().max(60), hex: z.string().regex(/^#[0-9a-f]{6}$/i), use: z.string().max(240) });
const adjustmentSchema = z.object({ title: z.string().max(100), detail: z.string().max(400) });
const saveInput = z.object({
  shopperImagePath: z.string().min(1).max(500),
  productImagePath: z.string().min(1).max(500).nullable(),
  productUrl: z.string().url().max(2048).nullable(),
  catalogProductId: z.string().uuid().optional(),
  styleNote: z.string().max(280).default(""),
  mood: z.enum(styleMoods),
  stylistComment: z.string().trim().min(1).max(240),
});

function catalogImageUrl(imagePath: string) {
  if (imagePath.startsWith("https://") || imagePath.startsWith("http://") || imagePath.startsWith("/")) return imagePath;
  const base = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
  const objectPath = imagePath.replace(/^catalog-media\//, "");
  return `${base}/storage/v1/object/public/catalog-media/${objectPath}`;
}

export const listCatalogProducts = createServerFn({ method: "GET" }).handler(async (): Promise<CatalogProductDto[]> => {
  const result = await publicClient().from("catalog_products").select("id, audience, product_name, category, subcategory, retailer, price, currency, image_path, product_url, refreshed_at").eq("is_active", true).eq("availability", "available").order("display_order");
  if (result.error) throw new Error("The catalogue is temporarily unavailable. Please try again.");
  return result.data.map((row) => ({ id: row.id, audience: row.audience as "men" | "women", name: row.product_name, category: row.category, subcategory: row.subcategory ?? null, retailer: row.retailer, price: row.price, currency: row.currency, image: catalogImageUrl(row.image_path), productUrl: row.product_url, refreshedAt: row.refreshed_at }));
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

const nameInput = z.object({
  firstName: z.string().trim().min(1).max(30),
  surname: z.string().trim().min(1).max(30),
});

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function namesFromClaims(claims: { email?: unknown; user_metadata?: unknown }) {
  const email = readText(claims.email) || "shopper";
  const metadata = claims.user_metadata && typeof claims.user_metadata === "object" ? claims.user_metadata as Record<string, unknown> : {};
  const full = readText(metadata.full_name) || readText(metadata.name);
  const parts = full.split(/\s+/).filter(Boolean);
  const first_name = (readText(metadata.given_name) || readText(metadata.first_name) || parts[0] || "").slice(0, 30);
  const surname = (readText(metadata.family_name) || readText(metadata.surname) || readText(metadata.last_name) || parts.slice(1).join(" ") || "").slice(0, 30);
  const display_name = (`${first_name} ${surname}`.trim() || full || email).slice(0, 60);
  return { first_name, surname, display_name, email };
}

function profileName(firstName: string, surname: string) {
  return `${firstName.trim()} ${surname.trim()}`.trim().slice(0, 60);
}

function slugifyLookName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "look";
}

function randomSlugSuffix(length = 6) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function buildShareSlug(productName: string | null | undefined) {
  const base = slugifyLookName(productName ?? "look");
  return `${base}-${randomSlugSuffix()}`.slice(0, 48);
}

async function mintShareSlug(
  supabase: SupabaseClient<Database>,
  productName: string | null | undefined,
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const shareSlug = buildShareSlug(productName);
    const existing = await supabase.from("saved_looks").select("id").eq("share_slug", shareSlug).maybeSingle();
    if (!existing.data) return shareSlug;
  }
  return `look-${randomSlugSuffix(10)}`;
}

export const ensureMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureProfile(context);
    const result = await context.supabase.from("profiles").select("id, handle, display_name, first_name, surname, bio, style_preferences").eq("id", context.userId).single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const saveMyName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => nameInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureProfile(context);
    const display_name = profileName(data.firstName, data.surname);
    const result = await context.supabase.from("profiles").update({
      first_name: data.firstName,
      surname: data.surname,
      display_name,
    }).eq("id", context.userId);
    if (result.error) throw new Error(result.error.message);
    return { first_name: data.firstName, surname: data.surname, display_name };
  });

const profileUpdateInput = nameInput.extend({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Handle must be 3–24 letters, numbers, or underscores."),
  bio: z.string().max(240),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileUpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureProfile(context);
    const display_name = profileName(data.firstName, data.surname);
    const result = await context.supabase.from("profiles").update({
      handle: data.handle,
      first_name: data.firstName,
      surname: data.surname,
      display_name,
      bio: data.bio.trim(),
    }).eq("id", context.userId).select("id, handle, display_name, first_name, surname, bio, style_preferences").single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const saveMyLook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureProfile(context);
    if (!data.shopperImagePath.startsWith(`${context.userId}/`) || (data.productImagePath && !data.productImagePath.startsWith(`${context.userId}/`))) throw new Error("Invalid image path.");
    const catalog = data.catalogProductId ? await context.supabase.from("catalog_products").select("id,product_name,retailer,price,currency,product_url").eq("id", data.catalogProductId).eq("is_active", true).eq("availability", "available").single() : null;
    if (catalog?.error) throw new Error("This product is no longer available in the catalogue.");
    const item = catalog?.data;
    let savedId = "";
    let shareSlug = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const nextSlug = await mintShareSlug(context.supabase, item?.product_name ?? "My ShopLook");
      const inserted = await context.supabase.from("saved_looks").insert({
        user_id: context.userId, shopper_image_path: data.shopperImagePath, product_image_path: data.productImagePath,
        product_url: item?.product_url ?? data.productUrl, catalog_product_id: item?.id ?? null, product_name: item?.product_name ?? null, product_retailer: item?.retailer ?? null, product_price: item?.price ?? null, product_currency: item?.currency ?? null, style_note: data.styleNote, mood: data.mood, headline: item?.product_name ?? "My ShopLook", summary: data.stylistComment,
        share_slug: nextSlug,
        colors: [] as Json, adjustments: [] as Json,
      }).select("id, share_slug").single();
      if (!inserted.error && inserted.data.share_slug) {
        savedId = inserted.data.id;
        shareSlug = inserted.data.share_slug;
        break;
      }
      if (inserted.error && inserted.error.code !== "23505") throw new Error(inserted.error.message);
    }
    if (!savedId || !shareSlug) throw new Error("This look could not be saved.");
    await context.supabase.from("shopper_events").insert({
      event_type: "look_saved",
      actor_type: "auth",
      user_id: context.userId,
      catalog_product_id: item?.id ?? null,
      saved_look_id: savedId,
      channel: "heart",
      metadata: {
        product_name: item?.product_name ?? null,
        retailer: item?.retailer ?? null,
        price: item?.price ?? null,
        currency: item?.currency ?? null,
        product_url: item?.product_url ?? data.productUrl,
        share_slug: shareSlug,
      },
    });
    const rows = [
      ...((item?.product_url ?? data.productUrl) ? [{ look_id: savedId, user_id: context.userId, label: item?.product_name ?? "Original product", search_term: "Original product", destination_url: (item?.product_url ?? data.productUrl)!, source: "submitted", display_order: 0 }] : []),
    ];
    if (rows.length) {
      const items = await context.supabase.from("saved_items").insert(rows);
      if (items.error) throw new Error(items.error.message);
    }
    return { id: savedId, shareSlug };
  });

export const ensureLookShareSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureProfile(context);
    const existing = await context.supabase.from("saved_looks").select("id, share_slug, product_name").eq("id", data.id).eq("user_id", context.userId).single();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data.share_slug) return { id: existing.data.id, shareSlug: existing.data.share_slug };
    for (let attempt = 0; attempt < 6; attempt++) {
      const shareSlug = await mintShareSlug(context.supabase, existing.data.product_name);
      const updated = await context.supabase.from("saved_looks").update({ share_slug: shareSlug }).eq("id", data.id).eq("user_id", context.userId).select("id, share_slug").single();
      if (!updated.error && updated.data.share_slug) return { id: updated.data.id, shareSlug: updated.data.share_slug };
      if (updated.error && updated.error.code !== "23505") throw new Error(updated.error.message);
    }
    throw new Error("This look could not get a share link.");
  });

export const getSharedLook = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().trim().min(6).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }).parse(input))
  .handler(async ({ data }) => {
    const client = publicClient();
    const result = await client.from("saved_looks").select("*, profiles!saved_looks_user_id_fkey(handle, display_name), saved_items(*)").eq("share_slug", data.slug).eq("is_removed", false).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Look not found.");
    const shopperImageUrl = (await signedUrl(client, result.data.shopper_image_path)) ?? "";
    if (!shopperImageUrl) throw new Error("Look not found.");
    return mapLook(
      result.data,
      result.data.saved_items,
      result.data.profiles,
      shopperImageUrl,
      await signedUrl(client, result.data.product_image_path),
      0,
      0,
    );
  });

async function ensureProfile(context: { supabase: SupabaseClient<Database>; userId: string; claims: { email?: unknown; user_metadata?: unknown } }) {
  const existing = await context.supabase.from("profiles").select("id").eq("id", context.userId).maybeSingle();
  if (existing.data) return;
  const { first_name, surname, display_name, email } = namesFromClaims(context.claims);
  const seed = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16) || "shopper";
  for (let attempt = 0; attempt < 4; attempt++) {
    const suffix = attempt ? `_${context.userId.slice(0, 6)}${attempt}` : `_${context.userId.slice(0, 6)}`;
    const result = await context.supabase.from("profiles").insert({
      id: context.userId,
      handle: `${seed.length >= 3 ? seed : "shopper"}${suffix}`.slice(0, 24),
      display_name,
      first_name,
      surname,
    });
    if (!result.error || result.error.code === "23505" && (await context.supabase.from("profiles").select("id").eq("id", context.userId).maybeSingle()).data) return;
    if (result.error.code !== "23505") throw new Error(result.error.message);
  }
  throw new Error("Could not create a unique profile. Please try again.");
}

export const listMyLooks = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await ensureProfile(context);
  const result = await context.supabase.from("saved_looks").select("*, saved_items(*)").eq("user_id", context.userId).order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  const paths = [...new Set(result.data.flatMap((row) => [row.shopper_image_path, row.product_image_path].filter((path): path is string => Boolean(path))))];
  const signed = paths.length ? await context.supabase.storage.from("shoplook-media").createSignedUrls(paths, 3600) : null;
  const urls = new Map(signed?.data?.map((entry) => [entry.path, entry.signedUrl]) ?? []);
  return result.data.map((row) => mapLook(row, row.saved_items, { handle: "you", display_name: "You" }, urls.get(row.shopper_image_path) ?? "", row.product_image_path ? urls.get(row.product_image_path) ?? null : null, 0, 0));
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
  return { id: row.id, userId: row.user_id, handle: profile.handle, displayName: profile.display_name, shopperImageUrl, productImageUrl, productUrl: row.product_url, catalogProductId: row.catalog_product_id, productName: row.product_name, productRetailer: row.product_retailer, productPrice: row.product_price, productCurrency: row.product_currency, styleNote: row.style_note, mood: z.enum(styleMoods).parse(row.mood), advice: readAdvice(row, items), isPublished: row.is_published, shareSlug: row.share_slug, createdAt: row.created_at, items: items.map((item) => ({ id: item.id, label: item.label, searchTerm: item.search_term, destinationUrl: item.destination_url, source: item.source === "submitted" ? "submitted" : "suggested" })), likeCount, commentCount };
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