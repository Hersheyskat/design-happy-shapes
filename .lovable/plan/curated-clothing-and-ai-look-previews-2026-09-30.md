# Curated clothing and AI look previews

## Goal
Let shoppers choose real clothing from a small, licensed catalog, then request an AI-generated image showing how an item could look with their uploaded photo. Preserve the instant demo while making the AI result visibly distinct from its illustrative overlay.

## Experience
- Keep the current opening photo upload and optional style note, followed by the existing quick apparel browsing, favorites, comparison, share, and shop flow.
- Replace or supplement the six demo cutouts with a curated catalog of clothing photos supplied with permission, item names, categories, and verified individual store URLs. If no licensed product photos and links are available, retain the existing clearly illustrative items until they are supplied; do not scrape retailer images or imply search results are exact products.
- Add a clear “Generate AI look” action for the selected clothing item. Show generation progress, a usable preview while waiting, a safe error/retry state, and the completed generated image. Label results as AI visualizations, not guaranteed fit, color, fabric, or exact product reproduction.
- Use each generated image for favorites, comparison, and sharing when available. Keep shopping tied to the actual catalog product and its real store page, not to details invented by the image model.
- Explain before submission that the shopper photo and garment image are sent to Google for generation; make generation opt-in. Keep personal images private, avoid public sharing without a separate user action, and offer a way to discard generated previews.

## Technical approach
- The current first screen uses bundled transparent apparel PNGs, a fixed-position browser overlay, and a flattened canvas for sharing; the existing AI service produces styling text, not try-on images. Preserve this immediate fallback rather than presenting it as realistic try-on.
- Use Google's official Nano Banana 2 model `gemini-3.1-flash-image` for image editing with the shopper photo and selected garment photo as separate references. Verify the documented request/response shape and account access before implementation. Keep the Google credential server-side via secure secrets, validate/compress images and limit generation requests, and never expose the credential in the browser.
- Add a dedicated server endpoint for image generation, process the resulting image for display, and keep generated results associated with the chosen product during the current session. Handle refusal, blocked content, quota, and temporary failures without silently substituting another model.
- Check consent, usage terms, image rights, costs, and privacy settings for the Google account before live use. A general image editor can produce convincing styling imagery but cannot guarantee garment fidelity or physical fit; evaluate generated results with several people, poses, and garment categories before calling it virtual try-on.
- Verify upload → choose garment → generate → favorite → compare → share → open matching shop page on mobile and desktop. If Google API access or licensed catalog assets are unavailable, keep the demo functional and report what remains blocked.

## Needed from owner
- A small set of clothing photos licensed for use in ShopLook, each with its exact product page URL; or permission to use a specific partner catalog/feed.
- Google API access for Nano Banana 2, provided through the app's secure secret flow (never pasted into page code). Billing and image-generation availability may need enabling on that account.
