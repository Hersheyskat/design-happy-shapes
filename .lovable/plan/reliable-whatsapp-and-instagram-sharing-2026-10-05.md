# Reliable WhatsApp and Instagram sharing

## Changes
- Make **WhatsApp** open WhatsApp directly using its supported share link, prefilled with a short ShopLook message and the ShopLook page link.
- Keep **Instagram** on the native image share sheet, because browsers cannot open Instagram with a private image pre-attached.
- Rename the Instagram action if needed so it clearly indicates the phone’s share menu will appear.
- Close the ShopLook sharing panel as soon as either handoff starts.
- Keep the generated photo private; do not upload it to create a public sharing URL.
- Retain the two-second fallback message only when Instagram image sharing is unavailable and the photo downloads instead.

## Validation
- Verify WhatsApp opens the correct `wa.me` share URL with encoded text and page link.
- Verify Instagram passes the generated PNG to the native share sheet.
- Verify cancellation is harmless, fallback feedback disappears after two seconds, and the sharing panel closes.

## Technical note
A browser can invoke the device share sheet with a file, but the operating system—not the website—chooses which apps are offered. WhatsApp supports a direct text/link handoff; direct private-image attachment to a named app is not available from a normal website.
