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
- Save generated looks only after an explicit action, using authenticated private storage and the existing owner-scoped saved-look records, because shopper images must remain private by default.
