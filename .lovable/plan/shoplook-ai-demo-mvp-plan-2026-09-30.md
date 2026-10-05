# ShopLook.ai demo MVP plan

## Goal
Ship a stable public demo with 10 men’s and 10 women’s products from mixed Indian retailers. Each product has a usable front image, current name and price, an exact retailer page, AI try-on, passwordless sign-in, and private saved looks.

## What already works
- Google sign-in, automatic profiles, private image storage, saved-look records, saved gallery, and reopening saved looks are already implemented.
- AI virtual-look generation already runs server-side through OpenRouter.
- Heart, save, share, and shop actions already require sign-in and resume afterward.
- The current catalogue is seven products embedded in the page; most do not yet have exact retailer pages or prices.

## Build

### 1. Create a reliable 20-product catalogue
- Add a `catalog_products` database table for audience (`men` or `women`), retailer, product name, price, currency, main image, exact product URL, availability, display order, active state, and last refresh time.
- Allow public read access only to active products; keep all catalogue writes private.
- Add exactly 10 men’s and 10 women’s active seed products, mixing Indian retailers where Apify returns complete and verifiable product details.
- Replace the hardcoded product list with database-backed products and clear Men/Women catalogue controls. Do not infer gender from the shopper’s photo.
- Preserve the last known good catalogue if any later refresh is incomplete.

### 2. Import products through Apify without making the demo depend on scraping
- Link the Apify connector and run `apify/e-commerce-scraping-tool` as a manual import, never during page load or a shopper action.
- Use product-detail/search output to collect product name, numeric price, currency, retailer, canonical purchase URL, and image candidates.
- Accept only products with an exact HTTPS product page, an INR price, and a clear primary front image; reject duplicates, search-result links, missing images, unavailable products, and malformed records.
- Curate the result down to 10 men’s and 10 women’s products across multiple supported Indian retailers.
- Copy approved images into ShopLook-managed catalogue storage so retailer CDN changes cannot break the demo. Retain source URLs and retailer attribution in the database.
- Treat refreshes as controlled imports: stage, validate all 20, then replace the active set atomically. If validation fails, continue serving the previous set.
- Do not add a live scraping button or expose Apify credentials in the browser. Future manual refreshes can be performed as a controlled maintenance update.

### 3. Make try-on and purchase seamless
- Feed the selected catalogue image into the existing OpenRouter try-on flow.
- Keep the previous generated look visible until the next look is ready.
- Show product name, formatted INR price, and retailer beside each catalogue item and completed look.
- Make Buy open that product’s exact canonical retailer page in a new tab; never fall back to a generic search for an active catalogue product.
- Persist the catalogue product ID plus a snapshot of its name, price, retailer, image, and purchase URL with each saved look, so saved history still makes sense after catalogue refreshes.

### 4. Add simple email-code sign-in
- Keep Google sign-in and add passwordless email-code signup/sign-in in the same dialog.
- Enable email authentication, send a one-time code, verify it in place, automatically create the existing profile, and resume the pending heart/save/share/buy action.
- Add resend, expiry, invalid-code, loading, and retry states without introducing passwords.

### 5. Harden saved looks and demo reliability
- Reuse the existing private saved-look database and media storage rather than building a second save system.
- Store only after an explicit Save action; retain private-by-default behavior and owner-only access.
- Save the generated image, catalogue snapshot, shopper style note, creation time, and exact purchase destination.
- Replace placeholder saved styling text with the actual generated styling result where available.
- Add image retry/refresh behavior for expired signed links and graceful product/image fallbacks.
- Replace the single-instance AI request throttle with a small database-backed cooldown so repeated clicks and multiple app instances behave consistently.
- Make profile creation resilient to rare handle collisions.

### 6. Verify and launch on ShopLook.ai
- Test email code and Google sign-in, action continuation, all 20 products, AI generation, repeated product switching, save/reopen/delete, and exact retailer handoffs.
- Test signed-out, signed-in, slow-network, unavailable-product, Apify failure, OpenRouter failure, and expired-image cases on phone and desktop.
- Run backend security checks and confirm one user cannot read another user’s private looks or photos.
- Publish only after all 20 product pages and prices pass a final manual check.
- Connect and verify the `shoplook.ai` domain after its DNS access is available; domain setup remains the only owner-side launch dependency.

## Technical details
- New catalogue data is delivered through a migration with explicit grants and row-level access rules; demo rows are seeded in that migration, not at page load.
- Catalogue images use a dedicated public product-media bucket; shopper and generated-look images stay in the existing private bucket.
- The Apify connection and its credential remain server-side. The import uses async run/poll/dataset retrieval with bounded retries and never blocks the customer experience.
- Catalogue replacement is transactional: validate a complete candidate batch before activating it and deactivating the previous batch.
- Product-image reuse should be limited to assets the retailer or manufacturer permits ShopLook to display; this is a launch-content requirement, not an app-flow blocker.

## Delivery boundaries
- This MVP sends shoppers to retailer checkout; it does not process payments, synchronize carts, guarantee live inventory, or claim retailer partnerships.
- Prices reflect the last manual refresh and display its date.
