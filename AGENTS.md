<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the first screen's photo local until the shopper explicitly requests a virtual look; while generation is pending or unavailable, show only their original photo, never a side-by-side or a misleading garment overlay.
- Keep OpenRouter-powered image generation opt-in and server-side; shopper photos only leave the browser after explicit action, while the illustrative demo stays available without a credential.
- Keep existing saved looks private and available in the Saved archive, but expose no action to save new looks; shopper images must remain private by default.
- Gate heart, save, share, and retailer actions through Google or passwordless email-code authentication and resume the selected action after sign-in, so profiles consistently own every engagement.
- Serve the manually refreshed 10-men/10-women catalogue from the database with ShopLook-hosted product images and exact retailer URLs, preserving the last good batch if an import fails.
- Suggest a catalogue from visible clothing style only after a separate opt-in action; never infer gender identity or transmit a shopper photo on selection, and always allow manual override.
- Pass Shop-to-Look product selections by catalogue product ID in the Look page URL, so the handoff survives refresh without storing shopper data.
- Treat Node abortIncoming and srvx response-close AbortError stacks as disconnected requests; preserve their cause when h3 converts them to opaque 500s so the response wrapper can return 499 without false crash reporting, while preserving unrelated server errors.
- Reserve explicit, non-shrinking image frames for primary and saved look photos and use contained image sizing; percentage-sized children inside auto-height controls collapse or crop when their image dimensions change.
- Send the original shopper photo, selected product name, and its photo for each virtual generation; infer garment type only from the product name and replace the corresponding entire garment, because partial edits leave mismatched sleeves or hem panels.
