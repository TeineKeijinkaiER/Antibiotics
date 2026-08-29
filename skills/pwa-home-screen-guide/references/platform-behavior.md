# Platform behavior

## iPhone and iPad

- Detect iPhone/iPad/iPod user agents and iPadOS devices that report `MacIntel` with multiple touch points.
- Installed launch detection uses `navigator.standalone === true` or the standalone display media query.
- There is no `beforeinstallprompt` equivalent. The user normally installs from Safari’s Share sheet with “Add to Home Screen.”
- Avoid relying on a platform-specific Share glyph: some test/browser fonts render it as a missing square. Pair a simple symbol or text label with the word “Share.”
- There is no dependable installation-complete event. Do not place a manual completion claim inside the instructional guide; standalone detection is the authoritative launch-time check.
- Closing the guide may suppress it for the current browser session, but must not be stored as installation completion.
- In-app browsers may omit the required action. Tell the user to open the page in Safari when the Share option is unavailable.

## Android

- Capture `beforeinstallprompt`, call `preventDefault()`, and retain the event for a user-initiated install button.
- If the event is unavailable, explain Chrome’s menu path: “Install app” or “Add to Home screen.” Labels vary by browser and installability state.
- Listen for `appinstalled` and persist completion. An accepted prompt may also be treated as completion.

## Cross-platform caveat

A site opened in a normal browser tab generally cannot reliably determine whether a separate installed PWA already exists. Suppress guidance in standalone mode and after an explicit completion signal; do not invent a global installation check.

## Minimum installability audit

- A linked web app manifest with app name, short name, start URL, scope, standalone display, theme/background colors, and suitable 192px/512px icons.
- A registered service worker controlling the intended scope.
- HTTPS in production, except localhost during development.
- Start URL and asset paths that remain valid under the deployment base path.
