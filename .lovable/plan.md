# Put “Try this on” on the product photo

## Changes
- Move “Try this on” from below the product details to a prominent button-style overlay near the bottom of each photo in the **Try another look** grid.
- Match the reference’s wide, pill-shaped placement with a dark background and high-contrast text, leaving a small inset from the photo edges.
- Keep brand, retailer and price below the photo; remove the old text-and-arrow action beneath them.
- Retain the two-column grid, search, existing selected indicator and generation feedback.

## Preserve
- Clicking the photo or its overlaid action uses the same existing try-on action and returns the shopper to their ShopLook above.
- No changes to AI generation, image quality, saving, sharing, purchase links or navigation.

## Technical details
- Update only the product-card presentation in `src/components/shoplook-result.tsx`, using semantic color tokens.
- Keep one accessible clickable control per card rather than nesting a button inside the existing button. Style its overlay as the visible “Try this on” action.
- Show “Creating…” in the overlay for the product being generated and retain disabled controls while generation is in progress.

## Check
- Verify that the overlay fits within each photo on mobile and larger screens, with readable text and unobstructed product details.
- Verify that selecting a product still starts the existing try-on flow and scrolls to the top image.