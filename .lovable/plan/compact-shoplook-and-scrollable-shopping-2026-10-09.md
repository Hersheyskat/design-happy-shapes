# Compact ShopLook and scrollable shopping

## Goal
Show products immediately and let shoppers browse down the page while their ShopLook is being created. Use the chosen **compact photo + two-column product grid** layout, retaining ShopLook’s current visual style.

## Opening screen
- Reduce the heading spacing and replace the large upload area with a compact “Add your photo” control and small uploaded-photo preview.
- Keep the upload/selfie choices, Woman / Man selection, and “Create your ShopLook” action.
- Show the first row of real catalogue products within the initial screen on typical phone sizes, with more products available by scrolling.
- Before Woman or Man is chosen, show a balanced preview of both catalogues without selecting one automatically. After selection, show that catalogue’s products.
- Tapping a product selects it as the first piece to create; it does not send the shopper’s photo or start generation. The existing creation button remains the explicit action.

## During creation and after completion
- Replace the tall look presentation with a compact image area, approximately 240–280px high on typical phones, showing the complete photo without cropping it to fill the space.
- Allow tapping the photo to inspect it full-size in a closable viewer.
- Keep “Creating your ShopLook…” confined to the image area; do not cover the page or lock scrolling during generation.
- Keep brand, retailer, price, heart, Share and Buy directly below the image, followed by the existing Stylist’s take and the product grid.
- Replace the horizontal “Create more looks” rail with a vertically scrollable two-column grid showing brand, retailer and price.
- Keep cards visually readable while a look is processing rather than fading the whole catalogue. Highlight the product being created; do not start overlapping generation requests.
- Retain the original photo until the first result is ready and retain the previous completed look when creating another. Finishing a request must not jump the shopper back to the top.

## Preserve existing behavior
- Heart remains the only private-save action and adds successful saves to comparison; no separate Save button.
- Preserve sign-in gates, comparison, sharing, retailer links and Shop-to-Look product selection.
- Keep bottom navigation available without covering the last row of products.
- Use the uploaded shopping screenshot only as a layout reference; do not add sale banners, invented discounts, ratings or new filtering features.

## Technical details
- Reuse the loaded catalogue and existing generation/save functions; no database, provider, model or generation-speed changes.
- Add a reusable catalogue grid for the opening and look views, using existing Button controls and semantic style tokens.
- Make compact sizing specific to the main Look screen so comparison images and other pages retain their existing proportions.
- Add an accessible full-image viewer with close control, Escape support and scroll locking only while that viewer is open.

## Verification
- Check phone and desktop layouts: opening-screen product visibility, unclipped compact images, readable cards, and navigation clearance.
- Exercise upload and selfie entry, catalogue/product selection, creation, scrolling during a real pending request, completion without scroll jumps, and full-size viewing.
- Check cached product switching, error/retry behavior, heart-to-save, comparison, Share and Buy for regressions.