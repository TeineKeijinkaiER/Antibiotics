/**
 * Service Worker の登録と更新検知（要件 NFR-002 / NFR-010）
 *
 * 開発サーバでは登録しない（ビルド時に生成される dist/sw.js のみを対象にする）。
 */

export type SwStatus = "unsupported" | "registering" | "ready" | "update-available";

/* ---- 状態の保持と購読（React の外で先に確定しうるため） ---- */

let status: SwStatus = "registering";
const listeners = new Set<(s: SwStatus) => void>();

function setStatus(next: SwStatus) {
  status = next;
  for (const fn of listeners) fn(next);
}

export function getSwStatus(): SwStatus {
  return status;
}

export function subscribeSwStatus(fn: (s: SwStatus) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** アプリ起動時に一度だけ呼ぶ */
export function startServiceWorker(): void {
  registerServiceWorker(setStatus);
}

function registerServiceWorker(onStatus: (status: SwStatus) => void): void {
  if (import.meta.env.DEV) return;
  if (!("serviceWorker" in navigator)) {
    onStatus("unsupported");
    return;
  }

  onStatus("registering");

  // sw.js は dist の直下に置かれる。import.meta.url はバンドル後 assets/ を指すため
  // 使えない。ドキュメントの baseURI を基準に解決する。
  const swUrl = new URL("sw.js", document.baseURI).href;
  const scope = new URL("./", document.baseURI).href;

  const register = () => {
    navigator.serviceWorker
      .register(swUrl, { scope })
      .then((registration) => {
        if (registration.active && !registration.waiting) onStatus("ready");

        // 既に新しい版が待機している
        if (registration.waiting) onStatus("update-available");

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state !== "installed") return;
            // 既存の SW があるなら「更新あり」、無いなら初回インストール完了
            onStatus(navigator.serviceWorker.controller ? "update-available" : "ready");
          });
        });
      })
      .catch(() => {
        // 登録に失敗してもアプリ自体は動く（オフラインにならないだけ）
        onStatus("unsupported");
      });
  };

  // load 済みなら即座に、まだなら load 後に登録する
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

/** 待機中の新しい Service Worker を適用してリロードする */
export async function applyUpdate(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.waiting?.postMessage("skip-waiting");
  await new Promise((resolve) => {
    navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  window.location.reload();
}
