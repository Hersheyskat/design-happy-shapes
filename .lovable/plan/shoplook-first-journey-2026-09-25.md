# ShopLook first journey

## Goal
Build a polished, mobile-first ShopLook experience at `/` using the uploaded prototype and handoff as the visual and interaction reference. The journey will cover adding photos, viewing a look, inspecting details, comparing products, sharing, and opening shopping details.

## Experience
- Recreate the supplied editorial visual language: warm white canvas, charcoal type, soft neutral surfaces, restrained coral accents, editorial serif headings, readable sans-serif body text, rounded imagery, and a centered mobile column around 410px on larger screens.
- Start with “See it. See yourself in it.” and real file inputs for a full-body photo and product screenshot, plus a product-link option and clear privacy reassurance.
- Keep the uploaded person photo available while the user moves through the journey and adds comparison products.
- Present a generated-look state dominated by the image, followed by exactly: **Share the look · Compare · Buy the look**.
- Include the concise stylist opinion, suggestion chips, and compact persistent message box shown by the reference.
- Add a detail view using the same saved image with crop/zoom controls; “Try a new pose” creates a separate illustrative version rather than treating zoom as a new result.
- Build comparison for the current look plus up to three additional product screenshots or links, rendered as a selectable 2×2 grid with full-size inspection and a stylist recommendation.
- Build a share sheet for the selected image or comparison, with native sharing when available and download/copy-link fallbacks. Social destinations are presented as handoffs only.
- Build a shopping sheet with product identity, variant, size, exact-versus-similar status, checked offers, last-checked information, and a retailer handoff. Any sample prices and destinations will be clearly illustrative.

## Interaction and states
- Use local previews for user-selected files; no personal image leaves the browser in this first version.
- Provide polished empty, uploading, processing, result, selection, and retry states so the full journey is testable.
- Use bundled illustrative fashion imagery for generated results and comparisons; do not imply that live AI generation or retailer matching has occurred.
- Preserve navigation context between the main look, detail, comparison, share, and buy sheets.
- Support narrow phones and centered desktop presentation, accessible labels, keyboard operation, visible focus states, and touch targets of at least 44px.

## Technical approach
- Keep the journey as one cohesive application route, with stateful views and bottom sheets matching the prototype’s interaction model.
- Add small reusable controls for upload fields, image viewer, action bar, stylist chat, comparison tiles, and sheets.
- Define ShopLook semantic color and typography tokens globally and use the existing project controls where available.
- Add route-specific ShopLook metadata for search and social previews.
- Verify the complete journey in the running preview at mobile and desktop widths, including uploads, view changes, sheets, selection, download/copy fallbacks, and layout stability.

## Deferred
- Accounts, cross-device saved history, server-side storage, live image generation, model selection, real stylist AI, voting, public share pages, retailer search, tracked links, live prices, credits, and payments.
