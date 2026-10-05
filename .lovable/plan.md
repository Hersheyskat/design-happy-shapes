# Fix saving multiple hearted ShopLooks

## What will change
- Let each completed ShopLook run its own private save when its heart is tapped, even if another look is still saving.
- Keep each heart unfilled until that specific look's image files and Saved entry both succeed.
- Show saving progress only on the look currently being saved and retain the existing comparison behavior.

## Verification
- Create two different looks, heart both in quick succession, and confirm two Saved entries and two storage folders.
- Confirm an upload failure leaves that look's heart unfilled and displays the error.
