# Heart-to-save ShopLook

## What will change
- Make the heart the only “Save my look” action after a ShopLook is generated.
- On the first heart tap, require sign-in when needed, add the look to comparison, and save it privately to the shopper’s Saved archive.
- Show clear loading and saved states on the heart while preserving the current look.
- Remove the separate “Save my look / Saved to my looks” button.
- Keep unhearting as removal from the current comparison shortlist; it will not delete the archived look from Saved.

## Technical details
- Reuse the existing private image upload and saved-look database flow.
- Merge the existing favorite and save sign-in continuation into one action to prevent duplicate saves.
- Keep save failures recoverable: if saving fails, the heart returns to its previous state and shows an error.
- Update the auth wording and project rules to describe heart-to-save behavior.
- Verify the signed-in heart → Saved archive flow and check the preview build.
