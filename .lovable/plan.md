# Look and Shop catalogue

## What will change

- Rename the bottom navigation labels:
  - **Create** becomes **Look**
  - **Discover** becomes **Shop**
- Keep the existing `/` and `/discover` addresses so current links continue working.
- Replace the current community feed on Shop with the full active product catalogue already stored for the demo.

## Shop page

- Add a search field at the top that filters by product name, retailer, and category.
- Add a clear **Women / Men** toggle, with product counts and an empty state when no products match.
- Display the matching products in a compact two-column image grid with product name, price, and retailer.
- Load the same 10 women’s and 10 men’s products currently used by the Look studio, including the ShopLook-hosted images gathered through the catalogue import.
- Preserve loading, image-failure, catalogue-error, and no-results states.

## Product-to-Look handoff

- Tapping a product in Shop opens the **Look** page with that product selected.
- Pin the selected product to the front of the matching product rail shown under the generated look.
- Reflect the selected product on the opening screen so shoppers know which item will be tried first.
- Once the shopper uploads or chooses a photo and starts the look, generate that selected product first.
- Keep manual Women / Men switching available; if the shopper switches to a catalogue that does not contain the selected item, use that catalogue’s first product instead.
- Use the product ID in the page address for the handoff, so it works reliably after refresh and does not expose shopper photos.

## Page polish and verification

- Update the Shop page title and sharing metadata to match its new shopping purpose.
- Keep heart, save, share, and retailer actions behind the existing sign-in flow.
- Verify search, both catalogue toggles, the 20-product grid, product selection, front-of-queue ordering, and first-look generation on phone and desktop.

## Technical details

- Reuse the existing database-backed `listCatalogProducts` function; no new table or import job is needed.
- Add validated optional product selection to the Look page’s search parameters and reorder only the displayed catalogue list, without changing database order.
- Replace the current Discover community query on `/discover` with the catalogue query while leaving saved looks and profiles unchanged.
