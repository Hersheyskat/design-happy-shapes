# Remove refresh and speed up ShopLook creation

## Changes
- Remove the top-right refresh/start-over icon while keeping the centered ShopLook title and back button.
- Resize large shopper photos in the browser before they are sent, preserving a clear portrait while reducing upload size.
- Preload and cache catalogue product images after a catalogue is chosen, so tapping the next product avoids another download before generation.
- Reuse the prepared shopper image and cached product image for each new look.
- Keep the current OpenRouter model and image quality unchanged; the AI generation itself will still take most of the wait time.

## Technical details
- Use browser-native image resizing rather than adding a new dependency.
- Keep shopper photos local until the shopper explicitly creates a look.
- Preserve the current generated look while the next one is processing.

## Verification
- Confirm the header no longer shows the refresh icon.
- Measure request preparation with a large uploaded photo and multiple sequential product selections.
- Verify generated results, product switching, and existing privacy behavior on the mobile layout.
