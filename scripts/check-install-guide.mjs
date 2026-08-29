#!/usr/bin/env node
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const EXEC = process.env.CHROMIUM_PATH ?? (process.platform === "win32"
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const failures = [];
const check = (condition, label) => {
  console.log(`  ${condition ? "ok " : "NG "} ${label}`);
  if (!condition) failures.push(label);
};
const acknowledge = () => localStorage.setItem("abx-navi/disclaimer-acknowledged/v1", "1");

const browser = await chromium.launch({ executablePath: EXEC });

console.log("iPhoneのブラウザ表示");
const ios = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
});
await ios.addInitScript(acknowledge);
const iosPage = await ios.newPage();
await iosPage.goto(BASE, { waitUntil: "networkidle" });
let text = await iosPage.locator(".install-guide").innerText();
await iosPage.screenshot({ path: "C:/tmp/install-guide-ios.png", fullPage: true });
check(
  (await iosPage.locator("#install-guide-title").innerText()) === "このアプリをすぐ使えるようにする",
  "目的が伝わるタイトルを表示する",
);
check(/Safariの「共有」/.test(text), "iPhoneでは共有ボタンからの手順を示す");
check(/ホーム画面に追加/.test(text), "「ホーム画面に追加」を案内する");
await iosPage.getByRole("button", { name: "今回は閉じる" }).last().click();
await iosPage.reload({ waitUntil: "networkidle" });
check((await iosPage.locator(".install-guide").count()) === 0, "同じ閲覧中は閉じた案内を再表示しない");
await ios.close();

console.log("\nAndroidのブラウザ表示");
const android = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36",
});
await android.addInitScript(acknowledge);
const androidPage = await android.newPage();
await androidPage.goto(BASE, { waitUntil: "networkidle" });
text = await androidPage.locator(".install-guide").innerText();
await androidPage.screenshot({ path: "C:/tmp/install-guide-android.png", fullPage: true });
const compactAndroidText = text.replace(/\s/g, "");
check(
  /この端末にアプリをインストール|Chrome右上のメニュー/.test(compactAndroidText),
  "AndroidではネイティブボタンまたはChromeメニューの手順を示す",
);
check(/インストール|ホーム画面に追加/.test(text), "Androidのインストール操作を案内する");
await androidPage.getByRole("button", { name: "ホーム画面に追加できた" }).click();
await androidPage.reload({ waitUntil: "networkidle" });
check((await androidPage.locator(".install-guide").count()) === 0, "追加完了後は案内を再表示しない");
await android.close();

console.log("\nホーム画面からのstandalone起動");
const standalone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
});
await standalone.addInitScript(() => {
  localStorage.setItem("abx-navi/disclaimer-acknowledged/v1", "1");
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query) => query === "(display-mode: standalone)"
    ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true }
    : original(query);
});
const standalonePage = await standalone.newPage();
await standalonePage.goto(BASE, { waitUntil: "networkidle" });
check((await standalonePage.locator(".install-guide").count()) === 0, "standalone起動では案内を表示しない");
await standalone.close();

await browser.close();
console.log(failures.length ? `\n失敗 ${failures.length}件` : "\nホーム画面追加ガイド: 全て合格");
process.exit(failures.length ? 1 : 0);
