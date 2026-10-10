# Move Share up and bring Compare beside Save and Buy

## Layout
- Move Share onto the upper-right corner of the ShopLook photo as an icon-only control, with an accessible label and tooltip.
- Keep the full-screen photo control separate and ensure Share does not overlap the creation message.
- Initially show only **Save** and **Buy** beneath the product details in an evenly spaced two-button row.
- When saving starts, reveal **Compare** in the left-hand position currently occupied by Share. The row then becomes **Compare · Save · Buy**.
- Keep Compare visible whenever there are looks in the comparison shortlist, including when browsing another product.
- Remove the distant Compare button beneath the product grid so there is only one Compare action on this screen.

## Behavior
- Show Compare immediately during saving, but keep it disabled until at least one saved look is available in the comparison shortlist.
- If saving fails and the shortlist is empty, return to the Save and Buy row.
- Keep the Save heart, saving progress, sign-in prompts and private saving behavior unchanged.
- Share and Compare reuse their existing actions; no changes to sharing destinations, purchases or AI generation.

## Technical details
- Limit changes to the result presentation in `src/components/shoplook-result.tsx`.
- Use the existing saving state and comparison count to control Compare visibility and availability; do not add looks optimistically or change saving logic.
- Use existing design-system buttons and semantic colors, with compact labels that fit the phone-sized layout.

## Verification
- Check the initial two-button row, saving state, successful save, failed save and switching products with an existing shortlist.
- Confirm icon-only Share opens the existing sharing flow without opening the full-screen viewer.
- Confirm Compare opens the existing comparison view and all controls remain readable on mobile and larger screens.