---
name: pwa-home-screen-guide
description: Implement and verify mobile PWA onboarding that explains iPhone and Android home-screen installation, uses the native install prompt when available, and disappears after standalone launch or confirmed installation. Use for web apps that need an add-to-home-screen guide; do not use for packaging a native iOS or Android app.
---

# PWA Home Screen Guide

Add a proactive installation guide without pretending browsers expose a universal “already installed” API.

## Workflow

1. Inspect the existing manifest, service-worker registration, scope, start URL, icons, and deployment base path. Fix only issues needed for installability.
2. Read [references/platform-behavior.md](references/platform-behavior.md) before choosing detection or completion behavior.
3. Show the guide only when all are true:
   - the device is iOS/iPadOS or Android;
   - the page is running in a normal browser, not `display-mode: standalone` or iOS `navigator.standalone`;
   - the user has not confirmed completion;
   - the user has not postponed it for the current browser session.
4. Capture `beforeinstallprompt` at module/app startup, not only after a modal mounts. On Android, offer the native prompt when captured and retain menu instructions as the fallback.
5. On iPhone/iPad, explain Safari’s Share button, “Add to Home Screen,” and final Add action. Mention Safari when an in-app browser or another browser may hide the required action.
6. Treat `appinstalled` or an accepted native prompt as completion. Because iOS has no equivalent reliable event, provide an explicit “added successfully” confirmation. Store completion persistently; store “not now” only for the current session.
7. Place the guide after any mandatory consent/disclaimer gate. Keep it accessible (`role=dialog`, `aria-modal`, labelled heading, keyboard-focus styles) and usable on short screens.
8. Add behavioral tests for iOS browser, Android browser, completed state, postponed state, and standalone display. Verify at representative phone widths.

For React/Vite projects, adapt the files in `assets/react-vite/`. Change the storage-key prefix and user-facing wording for the target app rather than copying product-specific names.

## Invariants

- Never show the guide during standalone/home-screen launch.
- Never show mobile install instructions on ordinary desktop browsers.
- Do not permanently suppress the guide merely because the user closes it once.
- Do not claim the website can always detect that a separately installed PWA exists; normal browser tabs and standalone windows are different launch contexts.
- Preserve existing update/service-worker behavior and existing user data.
