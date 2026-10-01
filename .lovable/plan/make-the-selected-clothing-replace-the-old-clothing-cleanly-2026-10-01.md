# Make the selected clothing replace the old clothing cleanly

## What will change

- Tighten the virtual-look instructions so the selected product photo is the sole source for the new garment's design, color, fabric, neckline, sleeves, hem, and fit details. The shopper photo remains the source for the person, pose, body, setting, and clothing outside the item being replaced.
- Explicitly replace the entire corresponding existing garment, including any visible cuffs, collar, hem, lower panels, or layered remnants. Do not blend the old shirt with the new shirt or leave an old short/sleeve section peeking through. Preserve trousers, shoes, and unrelated items when selecting a shirt or jacket, unless normal occlusion by the new garment requires otherwise.
- Pass the selected product's name alongside its image to identify which item should be worn if the catalogue photo includes multiple garments or a model. Keep the existing single-image result, framing safeguards, and current OpenRouter model.
- Preserve the existing original-photo display while generation is pending; never present an unfinished composite as a completed look.

## Verification

- Check the request contains the chosen product image and its name, and inspect a generated shirt look for an intact selected garment without remnants of the old top. Test switching between products so a prior generated item does not contaminate the new image. If the service cannot consistently honor the garment, report that limitation rather than promising pixel-perfect accuracy.

## Technical details

- Update the Look page's generation request and the server-side prompt/validation only; no catalogue, account, or page redesign changes.
- Keep uploaded shopper images server-side only after the shopper requests generation and retain the existing image and size validation.
