# AI styling advice for ShopLook

## Goal
Add an AI-powered outfit analysis feature to the existing look-comparison experience. Shoppers can upload one outfit photo and receive complementary color suggestions plus practical styling adjustments, without introducing virtual try-on language or imagery.

## Experience
- Add a clearly labeled “Style this look” entry point alongside the current comparison journey.
- Let the shopper choose an outfit photo, preview it locally, and request analysis.
- Present concise complementary color swatches and specific styling adjustments in the existing warm editorial ShopLook design.
- Include loading, retry, invalid-file, and clear AI error states while keeping the selected photo available.
- Make clear that suggestions are advisory and the image is analyzed only when the shopper requests it.

## Technical approach
- Enable Lovable Cloud for the protected server-side AI call and keep the workspace key off the browser.
- Add a server function that validates a compressed image payload and calls `openai/gpt-6-astra` through the Lovable AI Gateway Responses API.
- Stream the model request server-side, return validated structured advice, and surface safe Gateway errors without automatic retries for terminal failures.
- Add reusable analysis controls and results to the existing `/` route without changing the core look-comparison flow.
- Verify the real upload-to-advice journey in the preview on mobile and desktop, then inspect the matching AI Gateway request.
