# Saved looks and the ShopLook community

## Goal
Let shoppers save completed ShopLook results, revisit their progress, and participate in an in-app community where people publish looks, follow creators, like and discuss posts, and reuse products in their own look.

## Experience
- Add a clear **Save look** action to the AI suggestions result. Nothing is saved automatically.
- If the shopper is signed out, the save action opens sign-in and continues saving after sign-in.
- Add a **Saved looks** entry in the ShopLook header.
- Show saved results in a compact dated gallery using the shopper photo, product reference, AI headline, and save date.
- Opening a saved result restores its photos/product link and full color and styling suggestions.
- Let the shopper select exactly two saved looks and open a **Before & after** view with side-by-side photos and both sets of AI advice.
- Give every member a profile with a unique handle, display name, avatar, short bio, and public look count.
- Add an in-app **Discover** feed of published looks, plus a following feed for creators the member follows.
- Let members follow and unfollow people, like and unlike looks, and add or delete their own comments.
- Keep every saved look private by default. Its owner must explicitly publish it before it appears in profiles or feeds, and can return it to private later.
- Add **Try this product** to public looks. It starts the existing creation flow with that product image or link already selected, then asks the shopper for their own photo and produces fresh private AI suggestions.
- Include delete controls with confirmation, plus clear empty, loading, failure, blocked-content, and removed-content states.

## Data and privacy
- Store each saved result under the signed-in shopper’s account only.
- Save compressed shopper and product images in private file storage; store file paths, optional product link, and validated AI suggestions in the database.
- Public posts expose only deliberately published look data and safe profile fields; private saved looks remain owner-only.
- Enforce ownership for private records and files, and server-validated permissions for publishing, following, likes, comments, and deletion.
- Deleting a saved result also removes its uploaded files.
- Add report and block controls so members can hide unwanted people or content; reported items are retained for review rather than silently deleted.

## Technical approach
- Add email/password and Google sign-in, a public sign-in page, and protected account pages. Keep the existing bearer-token middleware and add a single root session listener so the header reflects sign-in state.
- Create profile, saved-look, follow, like, comment, report, and block tables with explicit grants, indexes, validation, and row-level access policies. Profile roles are not needed for this first version.
- Create private image storage with per-user upload/delete rules and controlled delivery for owner-only or published images.
- Add authenticated server functions for saving, publishing, feeds, profiles, follows, likes, comments, reports, blocks, and deletion. Derive identity from the signed-in session rather than submitted user IDs.
- Keep the current public upload-and-AI flow unchanged until the shopper chooses **Save look**.
- Add protected saved-history and before/after pages, plus public Discover, look-detail, and creator-profile pages in the existing warm editorial ShopLook style.
- Make feed counts and actions resistant to duplicate follows/likes, hide blocked users in both directions, and exclude private or removed looks from every public read path.

## Verification
- Verify account creation/sign-in, profile setup, explicit save, history reload, reopening suggestions, before/after comparison, publishing, feeds, follows, likes, comments, reports, blocks, product reuse, unpublishing, and deletion.
- Use two test accounts to confirm private looks and files cannot be accessed cross-account, while published looks expose only intended fields.
- Check the full private and social journeys on mobile and desktop and confirm the preview builds without errors.
