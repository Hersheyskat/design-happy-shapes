# Fix the shortlist heart state

- Clear the current shortlist whenever a new shopper photo is uploaded, alongside the generated looks already being cleared.
- Keep every newly generated ShopLook unselected until the shopper explicitly taps its heart.
- Only show generated, explicitly hearted looks in “Compare your looks,” preventing an old shortlist entry from appearing as the original photo.
- Verify the flow: upload photo, create a look, confirm the heart is empty, tap it, and confirm the look enters comparison.
