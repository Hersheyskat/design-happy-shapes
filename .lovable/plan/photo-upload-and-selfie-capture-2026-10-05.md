# Photo upload and selfie capture

## Changes
- Remove the top-right refresh/start-over icon from the Look screen.
- When “Add your photo” is selected, open a simple choice with:
  - **Upload your photo** — keep the existing file-upload journey unchanged.
  - **Take your selfie** — request camera access and show a live camera view on phone or computer.
- Add Capture, Retake, Use photo, and Cancel controls to the camera view.
- After “Use photo,” place the selfie into the same existing ShopLook journey as an uploaded photo.
- Show a clear message if camera permission is denied or no camera is available, while leaving Upload available.

## Privacy and behavior
- Keep the live camera and captured selfie on the shopper’s device.
- Send the selfie only after the shopper explicitly selects “Create your ShopLook,” matching the existing upload behavior.
- Stop the camera whenever the camera view closes, the photo is accepted, or the shopper leaves the page.
- Make no image-generation speed changes.

## Verification
- Verify upload remains unchanged.
- Verify camera permission, capture, retake, accept, cancel, and unavailable-camera states.
- Verify an accepted selfie enables the existing catalogue and ShopLook creation journey.
- Confirm the refresh icon is removed and the page builds successfully.
