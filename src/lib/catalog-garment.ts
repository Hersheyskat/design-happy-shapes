import { normalizeImageMime, sniffImageMime } from "@/lib/image-mime";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Load a catalogue image as JPG/PNG/WebP for look generation (retailer CDNs often negotiate AVIF). */
export async function catalogGarmentFile(imageUrl: string, id: string) {
  const response = await fetch(imageUrl, {
    headers: { Accept: "image/jpeg,image/png,image/webp,*/*;q=0.05" },
  });
  if (!response.ok) throw new Error("Could not load this product image. Try another look.");

  let blob = await response.blob();
  let type = normalizeImageMime(blob.type);
  if (!allowedTypes.has(type)) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    type = sniffImageMime(bytes) ?? type;
    blob = new Blob([bytes], { type: type || blob.type });
  }

  if (!allowedTypes.has(type)) {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare this product image.");
      context.drawImage(bitmap, 0, 0);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("Could not prepare this product image.")),
          "image/jpeg",
          0.92,
        ),
      );
      type = "image/jpeg";
    } finally {
      bitmap.close();
    }
  }

  if (!allowedTypes.has(type) || blob.size === 0 || blob.size > 4_000_000) {
    throw new Error("Could not prepare this product image. Try another look.");
  }

  const ext = type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg";
  return new File([blob], `${id}.${ext}`, { type });
}
