# Saved looks and progress comparison

## Goal
Let shoppers explicitly save a completed ShopLook result, return to it later, and compare two saved results as a before-and-after view.

## Experience
- Add a clear **Save look** action to the AI suggestions result. Nothing is saved automatically.
- If the shopper is signed out, the save action opens a simple Google sign-in step and continues saving after sign-in.
- Add a **Saved looks** entry in the ShopLook header.
- Show saved results in a compact dated gallery using the shopper photo, product reference, AI headline, and save date.
- Opening a saved result restores its photos/product link and full color and styling suggestions.
- Let the shopper select exactly two saved looks and open a **Before & after** view with side-by-side photos and both sets of AI advice.
- Include delete controls with confirmation. Empty, loading, save-failure, and delete-failure states remain clear and preserve the current result.

## Data and privacy
- Store each saved result under the signed-in shopper’s account only.
- Save compressed shopper and product images in private file storage; store file paths, optional product link, and validated AI suggestions in the database.
- Enforce account ownership for reading, creating, updating, and deleting both records and files.
- Deleting a saved result also removes its uploaded files.

## Technical approach
- Add Google sign-in and the existing protected-page structure, then register authenticated server requests with the current bearer-token middleware.
- Create a `saved_looks` table with ownership, image paths, product link, structured AI advice, and timestamps; include explicit grants and row-level account policies.
- Create a private image bucket with per-user upload/read/delete policies.
- Add authenticated server functions to save, list, fetch, and delete looks. Use the signed-in user identity server-side rather than trusting a submitted user ID.
- Keep the current public upload-and-AI flow unchanged until the shopper chooses **Save look**.
- Add protected saved-history and before/after pages in the existing warm editorial ShopLook style.

## Verification
- Verify sign-in, explicit save, history reload, reopening complete suggestions, choosing two looks, before/after comparison, and deletion.
- Confirm another account cannot access a saved record or private image path.
- Check the full journey on mobile and desktop and confirm the preview builds without errors.
