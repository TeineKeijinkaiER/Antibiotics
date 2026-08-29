export type MobilePlatform = "ios" | "android" | "other";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const COMPLETE_KEY = "abx-navi/install-guide-completed/v1";
const POSTPONED_KEY = "abx-navi/install-guide-postponed/v1";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    for (const listener of promptListeners) listener();
  });
  window.addEventListener("appinstalled", () => {
    markInstallGuideComplete();
    deferredPrompt = null;
    for (const listener of promptListeners) listener();
  });
}

export function detectMobilePlatform(): MobilePlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isiPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isiPadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function shouldShowInstallGuide(): boolean {
  if (detectMobilePlatform() === "other" || isStandaloneDisplay()) return false;
  try {
    return localStorage.getItem(COMPLETE_KEY) !== "1" && sessionStorage.getItem(POSTPONED_KEY) !== "1";
  } catch {
    return true;
  }
}

export function postponeInstallGuide(): void {
  try {
    sessionStorage.setItem(POSTPONED_KEY, "1");
  } catch {
    // Storage が使えなくても、呼び出し元のstateで現在の画面は閉じられる。
  }
}

export function markInstallGuideComplete(): void {
  try {
    localStorage.setItem(COMPLETE_KEY, "1");
    sessionStorage.removeItem(POSTPONED_KEY);
  } catch {
    // standalone 起動時は表示条件自体で抑止できる。
  }
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  promptListeners.add(listener);
  return () => promptListeners.delete(listener);
}

