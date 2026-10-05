# Restore private ShopLook saving

## What will change
- Add a **Save my look** action beneath each completed ShopLook, alongside the existing look actions.
- Require Google or passwordless email-code sign-in before saving, then automatically continue the save after sign-in.
- Upload the generated ShopLook image and its product reference to the existing private media storage.
- Save the look under the authenticated account with its product details and Stylist’s take.
- Prevent duplicate taps while saving and show clear saved, retry, and failure states.
- Keep the existing **Saved** page and make newly saved results open correctly there after refresh or on another device.

## Privacy and account behavior
- New looks remain private unless the owner explicitly publishes them from the Saved page.
- Ownership comes only from the verified signed-in account; the browser cannot choose another user ID.
- Login remains passwordless: Google or a six-digit email code. No password will be created or exposed.

## Technical details
- Reuse the existing authenticated save function, private storage bucket, ownership rules, and sign-in token middleware.
- Adapt the saved-look payload and detail view to the current generated-image and two-sentence Stylist’s take format.
- Clean up uploaded files if the database save fails, avoiding orphaned private images.
- Update the project requirement that previously disabled new saves.

## Verification
- Test signed-out save → sign-in → resumed save.
- Test signed-in save → Saved archive → open saved look, including after page refresh.
- Confirm the stored row belongs to the authenticated user and remains private by default.
- Confirm repeated taps do not create duplicates and failed saves can be retried.
