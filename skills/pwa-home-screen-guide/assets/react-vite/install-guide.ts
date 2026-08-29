export type MobilePlatform = "ios" | "android" | "other";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

// Replace this prefix for the target app.
const COMPLETE_KEY = "your-app/install-guide-completed/v1";
const POSTPONED_KEY = "your-app/install-guide-postponed/v1";
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    markComplete();
    deferredPrompt = null;
    listeners.forEach((listener) => listener());
  });
}

export function detectPlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "other";
  const isiPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || isiPadOS) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "other";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;
}

export function shouldShowGuide(): boolean {
  if (detectPlatform() === "other" || isStandalone()) return false;
  try {
    return localStorage.getItem(COMPLETE_KEY) !== "1" && sessionStorage.getItem(POSTPONED_KEY) !== "1";
  } catch {
    return true;
  }
}

export function postpone(): void {
  try { sessionStorage.setItem(POSTPONED_KEY, "1"); } catch { /* current state can still close */ }
}

export function markComplete(): void {
  try {
    localStorage.setItem(COMPLETE_KEY, "1");
    sessionStorage.removeItem(POSTPONED_KEY);
  } catch { /* standalone detection remains available */ }
}

export const getInstallPrompt = () => deferredPrompt;
export function subscribePrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
