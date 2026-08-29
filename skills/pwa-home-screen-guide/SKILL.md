---
name: pwa-home-screen-guide
description: Implement and verify mobile PWA onboarding that explains iPhone and Android home-screen registration, uses the native install prompt when available, and stays separate from the browser actions it teaches. Use for web apps that need an add-to-home-screen guide; do not use for packaging a native iOS or Android app.
---

# PWA Home Screen Guide

Add a proactive installation guide without pretending browsers expose a universal “already installed” API.

## Workflow

1. Inspect the existing manifest, service-worker registration, scope, start URL, icons, and deployment base path. Fix only issues needed for installability.
2. Read [references/platform-behavior.md](references/platform-behavior.md) before choosing detection or completion behavior.
3. Show the guide only when all are true:
   - the device is iOS/iPadOS or Android;
   - the page is running in a normal browser, not `display-mode: standalone` or iOS `navigator.standalone`;
   - the browser has not reported native installation completion;
   - the user has not postponed it for the current browser session.
4. Capture `beforeinstallprompt` at module/app startup, not only after a modal mounts. On Android, offer the native prompt when captured and retain menu instructions as the fallback.
5. On iPhone/iPad, explain Safari’s Share button, “Add to Home Screen,” and final Add action. Mention Safari when an in-app browser or another browser may hide the required action.
6. Treat `appinstalled` or an accepted native prompt as completion. iOS has no equivalent reliable event: do not ask users to claim completion inside the guide. Rely on standalone detection after a real home-screen launch. Closing the guide suppresses it only for the current session.
7. Make the guide unmistakably instructional. Use a plain title such as “このアプリを追加”, explain why registration helps, and direct the user to Safari or Chrome for the actual action. Use only a labelled close icon in the guide; do not add “追加できた” or “今回は閉じる” action rows.
8. Place the guide after any mandatory consent/disclaimer gate. Keep it accessible (`role=dialog`, `aria-modal`, labelled heading, keyboard-focus styles) and usable on short screens.
9. Add behavioral tests for iOS browser, Android browser, native completed state, postponed state, and standalone display. Verify at representative phone widths.

For React/Vite projects, adapt the files in `assets/react-vite/`. Change the storage-key prefix and user-facing wording for the target app rather than copying product-specific names.

## Invariants

- Never show the guide during standalone/home-screen launch.
- Never show mobile install instructions on ordinary desktop browsers.
- Do not permanently suppress the guide merely because the user closes it once.
- Do not present controls that imply Share, Add, or installation completion happens inside the instructional guide.
- Do not claim the website can always detect that a separately installed PWA exists; normal browser tabs and standalone windows are different launch contexts.
- Preserve existing update/service-worker behavior and existing user data.
