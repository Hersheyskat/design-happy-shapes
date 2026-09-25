# AI styling advice for ShopLook

## Goal
Make the first ShopLook screen an effortless two-input starting point: shoppers add their own outfit photo plus a product screenshot or product link, then receive AI-powered complementary colors and practical styling adjustments. The experience remains about comparing and refining complete looks, not virtual try-on.

## Experience
- Lead with “See the magic” and two clear inputs: “Your photo” and “Product screenshot or link.”
- Preview both uploads immediately and enable the main action once the shopper photo and either product input are ready.
- Keep a sample path available so the journey can be explored without personal uploads.
- Present concise complementary color swatches and specific styling adjustments in the existing warm editorial ShopLook design.
- Include loading, retry, invalid-file, and clear AI error states while keeping the selected photo available.
- Make clear that suggestions are advisory and the image is analyzed only when the shopper requests it.

## Technical approach
- Enable Lovable Cloud for the protected server-side AI call and keep the workspace key off the browser.
- Add a server function that validates compressed image payloads and an optional product URL, then calls `openai/gpt-6-astra` through the Lovable AI Gateway Responses API.
- Stream the model request server-side, return validated structured advice, and surface safe Gateway errors without automatic retries for terminal failures.
- Add reusable analysis controls and results to the existing `/` route without changing the core look-comparison flow.
- Verify the real upload-to-advice journey in the preview on mobile and desktop, then inspect the matching AI Gateway request.
