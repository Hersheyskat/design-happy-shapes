# Keep the generated look prominent

## Outcome
The completed look remains the visual focus on mobile, before and after loading. Product details and alternatives sit below it; the page scrolls vertically instead of squeezing the image.

## Work
1. Reproduce the small-image state and record the rendered image, its parent sizes, computed sizing/overflow rules, and actual image dimensions. Test portrait, square, and landscape sources, loading and product switching. The live catalogue did not return products during initial inspection, so use representative browser test data if needed and separately retry the real flow. Distinguish a layout fault from an image whose subject is already tiny in the generated file.
2. Give the Look screen a reserved, full-width image area around 45–60% of mobile screen height, with a roughly 320px minimum. Remove conflicting auto-height/percentage-height behavior, prevent shrinking, and contain the image without cropping or stretching. Preserve the existing original-photo fallback while a new look generates. Keep tap-to-expand and add usable zoom inside the enlarged view.
3. Tighten the details below: optional stylist note when present, concise product details, Share and Buy, then a compact horizontally scrolling alternative-product strip. Prevent long names and extra products from creating horizontal page overflow. Do not add a new Save action.
4. Apply the same uncropped, stable display treatment to completed saved-look detail views and check the shortlist/archive/progress image treatments where relevant; do not mistake the original shopper photo for a generated image. Leave generation settings unchanged unless inspecting a source image confirms a framing problem.
5. Verify first load, refresh, pending/completed look, switching products, and portrait/square/landscape sources at 360, 390, and 430px widths. Check saved looks with an authenticated session if available. Capture corrected mobile screenshots and report the observed cause and any verification blocked by unavailable data.

## Technical notes
The Look screen currently nests `size-full` image elements inside a ghost Button with `h-auto`, an aspect ratio, and inherited inline-flex styling. The saved-look detail uses `object-cover`. These are sizing and cropping candidates, not yet a proven explanation for the screenshot: live reproduction is currently blocked because the preview catalogue did not return products during inspection. Saved-look records expose `shopperImageUrl` and a separate product-reference image; the generated image is held in Look-page state, so image-source identity must be checked before altering saved views.
