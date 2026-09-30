# Polish the ShopLook demo

## Goal
Make the photo-to-look journey feel smooth and convincing for a live demo, without changing its current visual identity or implying that a side-by-side product photo is a virtual try-on.

## What will change
1. **Opening screen:** Keep photo upload first and the style note optional. Make the uploaded-photo preview, sample-photo choice, and primary action immediately clear; keep the shopper's photo on the device until they explicitly request an AI look.
2. **Look screen:** Make the two states unmistakable: a quick side-by-side preview before generation, then a clearly labeled AI visualization after generation. Keep product selection, heart, sharing, and shopping actions easy to scan, with useful image-loading and failure states.
3. **Comparison:** Preserve the scrollable, up-to-four-across favorites presentation and ensure each look retains its own generated image when available, with Share and Buy below it. Make the empty and returning states clear.
4. **Demo reliability:** Check upload, sample photo, style note, product switching, AI generation, favorites, compare, share, and Buy on phone and desktop. Surface any OpenRouter failure without losing the instant preview.

## Technical notes
- Refine the existing opening, try, and compare views in the home page; reuse the current semantic colors, fonts, and Button controls.
- Keep OpenRouter requests server-side and opt-in. Do not send shopper photos during upload or product browsing.
- Do not invent exact retailer matches: Buy continues to open clearly labeled Amazon India searches until exact product URLs are supplied.
- This pass does not add accounts, saved-look persistence, or a new product feed.
