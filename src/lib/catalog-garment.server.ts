import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { normalizeImageMime, sniffImageMime } from "@/lib/image-mime";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function catalogImageUrl(imagePath: string) {
  if (imagePath.startsWith("https://") || imagePath.startsWith("http://") || imagePath.startsWith("/"))
    return imagePath;
  const base = process.env["SUPABASE_URL"]?.replace(/\/$/, "");
  if (!base) return null;
  const objectPath = imagePath.replace(/^catalog-media\//, "");
  return `${base}/storage/v1/object/public/catalog-media/${objectPath}`;
}

async function fetchGarmentFile(imageUrl: string, accept: string) {
  const response = await fetch(imageUrl, {
    headers: { Accept: accept },
    redirect: "follow",
  }).catch(() => null);
  if (!response?.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > 4_000_000) return null;
  let type = normalizeImageMime(response.headers.get("content-type") ?? "");
  type = sniffImageMime(buffer) ?? type;
  if (!imageTypes.has(type)) return null;
  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return new File([buffer], `garment.${ext}`, { type });
}

/** Resolve a trusted catalogue garment image as JPG/PNG/WebP (avoids retailer AVIF negotiation). */
export async function catalogGarmentFromProductId(productId: string) {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !key) return null;
  const client = createClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const product = await client
    .from("catalog_products")
    .select("image_path")
    .eq("id", productId)
    .eq("is_active", true)
    .eq("availability", "available")
    .maybeSingle();
  if (product.error || !product.data?.image_path) return null;
  const imageUrl = catalogImageUrl(product.data.image_path);
  if (!imageUrl || !imageUrl.startsWith("https://")) return null;
  return (
    (await fetchGarmentFile(imageUrl, "image/jpeg,image/png,image/webp,*/*;q=0.05")) ??
    (await fetchGarmentFile(imageUrl, "image/jpeg"))
  );
}
