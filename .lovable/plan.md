# Smaller ShopLook preview

- Reduce the height of the main Look-screen photo so the first product thumbnails peek into view without scrolling on typical screen sizes.
- Keep the whole generated outfit visible by fitting the image inside the shorter area rather than cropping it more tightly.
- Preserve product details, heart, Share, Buy, and Stylist’s take in their current order. Keep the upload screen and comparison images unchanged.

## Technical details
- Give the main `LookImage` a compact display option with viewport-aware height; leave its existing comparison sizing unchanged.
- Target a preview height around 35% of the available viewport, capped on taller screens, and adjust nearby vertical spacing only as needed to reveal the product rail.
- Verify the finished-look layout at short and tall viewport sizes, including a populated Stylist’s take, with no overlap from the bottom navigation.
- No changes to generation, saving, sharing, or catalogue behavior.