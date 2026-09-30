# Demo-safe shopping links and saved looks

## Goal
Make the demo feel complete without claiming a retailer partnership, and let signed-in shoppers save and revisit generated looks.

## Shopping links
- Keep each **Buy** action linked to a relevant public Amazon India search until exact product pages or a commercial arrangement are available.
- Open retailer results in a new tab and label the action clearly as **Search on Amazon** rather than implying the item is sold by ShopLook.
- Add a short disclosure near shopping actions: links are for discovery, with no current retailer partnership; price, stock, seller, and product match can vary.
- Keep each product's shopping destination separate so exact URLs can replace searches later without redesigning the experience.

## Saved-look journey
- Add **Save look** beside each completed AI look; do not save anything automatically.
- If signed out, open the existing sign-in dialog and continue the pending save after successful sign-in.
- Save the generated ShopLook.ai image, selected catalogue product reference, style note, product destination, and creation date to the shopper's private account.
- Reuse the existing private saved-look gallery, reopening, publishing, deletion, and comparison features.
- Show clear saving, saved, retry, and duplicate-save states without interrupting look generation or shopping.

## Technical details
- Upload the generated image and catalogue reference to the existing private ShopLook media storage before calling the existing authenticated save function.
- Extend the saved-look payload only where required to represent the current demo's generated image and style note; preserve ownership rules and private-by-default behavior.
- Keep authentication attached to protected server calls and never put shopper images into copied public links.
- Treat retailer URLs as configurable catalogue data so searches can later be replaced with supplied exact pages.

## Verification
- Test signed-out Save → sign-in → automatic save completion.
- Test signed-in save, gallery reload, opening the saved look, duplicate handling, deletion, and comparison.
- Confirm another account cannot access a private saved image or record.
- Check every shopping action opens its corresponding retailer search and displays the no-partnership disclosure on phone and desktop.
