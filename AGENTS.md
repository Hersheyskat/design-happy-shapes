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
- Use the heart as the single explicit action that saves a completed ShopLook to the signed-in shopper's private Saved archive and adds it to comparison; never auto-save or show a separate save control.
- Gate heart-to-save, share, and retailer actions through Google or passwordless email-code authentication and resume the selected action after sign-in, so profiles consistently own every engagement.
- Serve the manually refreshed 10-men/10-women catalogue from the database with ShopLook-hosted product images and exact retailer URLs, preserving the last good batch if an import fails.
- Suggest a catalogue from visible clothing style only after a separate opt-in action; never infer gender identity or transmit a shopper photo on selection, and always allow manual override.
- Pass Shop-to-Look product selections by catalogue product ID in the Look page URL, so the handoff survives refresh without storing shopper data.
- Treat Node's abortIncoming socket-close error as a disconnected request, not an app crash, while preserving reporting for other server errors.
- Generate one concise, image-grounded stylist comment after each completed ShopLook, without delaying or replacing the generated image.
- Share Instagram looks as private image files through the device share sheet with a local download fallback; open WhatsApp directly with a ShopLook text and page link.

- Keep the result presentation isolated from generation and engagement logic, with a viewport-aware image hero and full-screen viewer; preserve comparison image proportions so result sizing never changes shortlist framing.
- Keep result product browsing in the presentation component and reuse the existing selection callback for try-on; scrolling to the image must not change generation or saving behavior.
