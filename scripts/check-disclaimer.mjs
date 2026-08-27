#!/usr/bin/env node
/**
 * 適用範囲の明示と「アプリの説明」の回帰テスト（要件 FR-012）
 *
 * 本アプリの内容は当院の院内マニュアルに由来し、適応外使用・採用薬・使用申請のルール・
 * アンチバイオグラムは他施設に当てはまらない。GitHub Pages で配信すると院外からも
 * 到達しうるため、適用範囲の宣言が消えていないことを機械的に確認する。
 *
 * 使い方: npx vite preview を起動した状態で node scripts/check-disclaimer.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const EXEC =
  process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const failures = [];
const check = (cond, label) => {
  console.log(`  ${cond ? "ok " : "NG "} ${label}`);
  if (!cond) failures.push(label);
};

const browser = await chromium.launch({ executablePath: EXEC });
const context = await browser.newContext({ viewport: { width: 900, height: 1000 } });
const page = await context.newPage();

/* ---- 初回確認（FR-012-1） ---- */
console.log("初回起動時の確認");
await page.goto(BASE, { waitUntil: "networkidle" });
check((await page.locator(".gate").count()) === 1, "免責確認画面が表示される");
check(
  (await page.locator(".lane-tile").count()) === 0,
  "確認するまで本体（大項目）に到達できない",
);

const gateText = await page.locator(".gate").innerText();
check(/院内利用を想定/.test(gateText), "「院内利用を想定したアプリ」の宣言がある");
check(
  /適応外使用/.test(gateText) && /アンチバイオグラム/.test(gateText),
  "適応外使用・アンチバイオグラムが当院固有である旨がある",
);
check(/最終的な投与判断は主治医/.test(gateText), "最終判断は主治医である旨がある");
check(/外部に送信されません/.test(gateText), "患者条件を外部送信しない旨がある");

await page.locator('button:has-text("確認しました")').click();
await page.waitForTimeout(250);
check((await page.locator(".lane-tile").count()) === 4, "確認後は大項目4ボタンが表示される");

await page.reload({ waitUntil: "networkidle" });
check((await page.locator(".gate").count()) === 0, "再訪時は再表示されない（端末に記録される）");

/* ---- フッタの宣言（FR-012-2） ---- */
console.log("\n全画面のフッタ");
check(
  /院内利用を想定/.test(await page.locator("footer.foot").innerText()),
  "フッタに適用範囲の宣言がある",
);

/* ---- アプリの説明（FR-012-3） ---- */
console.log("\nアプリの説明画面");
await page.locator('header button:has-text("アプリの説明")').click();
await page.waitForTimeout(250);
const about = await page.locator("main").innerText();
const SECTIONS = [
  ["院内利用を想定", "適用範囲の宣言"],
  ["このアプリは何か", "このアプリは何か"],
  ["使い方", "使い方"],
  ["注意事項", "注意事項"],
  ["アップデート", "アップデートとオフライン利用"],
  ["端末内でのみ", "入力した患者情報の扱い"],
  ["免責事項", "免責事項"],
  ["原典・問い合わせ", "原典・問い合わせ"],
];
for (const [needle, label] of SECTIONS) {
  check(new RegExp(needle).test(about), `「${label}」のセクションがある`);
}
check(
  /添付文書/.test(about) && /適応外使用は当院の取り決め/.test(about),
  "注意事項に添付文書の確認と適応外使用の但し書きがある",
);

/* ---- 別端末では改めて表示される ---- */
console.log("\n別の端末");
const other = await browser.newContext({ viewport: { width: 900, height: 1000 } });
const otherPage = await other.newPage();
await otherPage.goto(BASE, { waitUntil: "networkidle" });
check((await otherPage.locator(".gate").count()) === 1, "確認画面が改めて表示される");

await browser.close();
console.log(failures.length > 0 ? `\n失敗 ${failures.length}件` : "\n適用範囲の明示: 全て合格");
process.exit(failures.length > 0 ? 1 : 0);
