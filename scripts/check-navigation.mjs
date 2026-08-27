#!/usr/bin/env node
/**
 * 画面構成の回帰テスト（要件 FR-000 / FR-011 / FR-013）
 *
 * オープニングの大項目、その他の中身、成人／小児の選択、AWaRe分類の選択、
 * 小児で成人向けの情報を隠すこと、を機械的に確認する。
 *
 * 使い方: npx vite preview を起動した状態で node scripts/check-navigation.mjs
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
await context.addInitScript(() => {
  try {
    localStorage.setItem("abx-navi/disclaimer-acknowledged/v1", "1");
  } catch {
    /* noop */
  }
});
const page = await context.newPage();

const home = () => page.goto(BASE, { waitUntil: "networkidle" });
const click = async (text) => {
  await page.locator(`button:has-text("${text}")`).first().click();
  await page.waitForTimeout(220);
};
const openDrug = async (lane, mode, name) => {
  await home();
  await click(lane);
  await click(mode);
  await page.fill('input[aria-label="薬剤名を入力"]', name);
  await page.waitForTimeout(300);
  await page.locator(".result").first().click();
  await page.waitForTimeout(300);
};

/* ---- オープニング ---- */
console.log("オープニング");
await home();
check((await page.locator(".top-btn").count()) === 4, "大項目は4ボタン");
const tops = await page.locator(".top-btn").allInnerTexts();
for (const label of ["内服薬", "注射薬", "菌種別", "その他"]) {
  check(tops.some((t) => t.trim() === label), `大項目に「${label}」がある`);
}
check(
  (await page.locator("h1").innerText()).includes("TKH抗菌薬投与マニュアル"),
  "タイトルが表示される",
);
check((await page.locator(".opening-art").count()) === 1, "イラストが表示される");
check(
  (await page.locator('header button:has-text("アプリの説明")').count()) === 1,
  "「アプリの説明」がヘッダー（欄外）にある",
);

/* ---- その他 ---- */
console.log("\nその他");
await home();
await click("その他");
check((await page.locator(".top-btn").count()) === 4, "その他は4ボタン");
const others = await page.locator(".top-btn").allInnerTexts();
for (const label of ["周術期", "暴露後予防投与", "小児体重服用量簡易表", "AMR対策"]) {
  check(others.some((t) => t.trim() === label), `その他に「${label}」がある`);
}
check(
  !(await page.locator("main").innerText()).includes("アナフィラキシー"),
  "アナフィラキシーの項目が削除されている",
);

/* ---- 成人／小児 ---- */
console.log("\n成人／小児の選択");
await home();
await click("内服薬");
check((await page.locator(".top-btn").count()) === 2, "成人・小児の2ボタンのみ");

/* ---- 内服薬のAWaRe選択 ---- */
console.log("\n内服薬（AWaRe分類）");
await click("成人");
check(
  (await page.locator('input[aria-label="薬剤名を入力"]').count()) === 1,
  "薬剤名の入力欄がある",
);
check((await page.locator(".result").count()) === 0, "この画面では薬剤一覧を出さない");
const awareText = await page.locator(".aware-lead").innerText();
check(/AWaRe分類/.test(awareText), "AWaRe分類の解説がある");
check(/Access から選択/.test(awareText), "理由がなければAccessから選ぶことを強調している");
const bigButtons = await page.locator(".top-btn").allInnerTexts();
for (const label of ["Access", "Watch", "Reserve"]) {
  check(bigButtons.some((t) => t.includes(label)), `大きなボタンに「${label}」がある`);
}

// 分類を選ぶと薬剤名が並ぶ
await click("Access");
check((await page.locator(".result").count()) > 0, "Accessを選ぶと薬剤名が一覧される");

/* ---- 小児では成人向けの情報を隠す ---- */
console.log("\n小児での表示");
await openDrug("注射薬", "成人", "セフェピム");
check((await page.locator(".renal-row").count()) > 0, "成人: 腎機能低下時の区分表が出る");

await openDrug("注射薬", "小児", "セフェピム");
const ped = await page.locator("main").innerText();
check((await page.locator(".renal-row").count()) === 0, "小児: 腎機能低下時の区分表を出さない");
check(/成人を対象/.test(ped), "小児: 成人向けである旨を明示する");
check(!/CCr > 50/.test(ped), "小児: 成人のCCr区分の用量が出ない");
check(/通常量（小児）/.test(ped), "小児: 小児の通常量は表示される");

/* ---- 薬剤ごとのツールへの導線 ---- */
console.log("\n薬剤に紐づくツール");
await openDrug("注射薬", "成人", "バンコマイシン");
check(
  (await page.locator('button:has-text("TDM対象")').count()) === 1,
  "TDM対象の薬剤から投与設計へ飛べる",
);
check(
  (await page.locator('button:has-text("当院採用注射抗菌薬一覧")').count()) === 1,
  "製剤情報から採用薬一覧へ飛べる",
);
await openDrug("注射薬", "成人", "ベンジルペニシリン");
check(
  (await page.locator('button:has-text("ペニシリンG持続静注")').count()) === 1,
  "ペニシリンGから持続静注の説明へ飛べる",
);

/* ---- 患者条件フォームを出す画面 ---- */
console.log("\n患者条件フォームの出し分け");
const hasPatientButton = async () =>
  (await page.locator('header button:has-text("患者条件")').count()) > 0;

await home();
await click("菌種別");
check(!(await hasPatientButton()), "菌種別では患者条件を出さない");

for (const item of ["暴露後予防投与", "小児体重服用量簡易表", "AMR対策"]) {
  await home();
  await click("その他");
  check(!(await hasPatientButton()), `その他のメニューでは出さない（${item}の前）`);
  await click(item);
  check(!(await hasPatientButton()), `${item}では出さない`);
}

await home();
await click("その他");
await click("周術期");
check(await hasPatientButton(), "周術期では患者条件を出す（体重で1回量が決まるため）");

await home();
await click("内服薬");
await click("成人");
check(await hasPatientButton(), "薬剤レーンでは患者条件を出す");

/* ---- 戻る／ホーム ---- */
console.log("\n戻る／ホーム");
await home();
await click("内服薬");
await click("成人");
await click("Access");
check((await page.locator(".navkey").count()) === 2, "戻る・ホームの2キーがある");
await page.locator('.navkey:has-text("戻る")').click();
await page.waitForTimeout(250);
check((await page.locator(".aware-lead").count()) === 1, "戻るで分類の選択へ戻る");
await page.locator('.navkey:has-text("戻る")').click();
await page.waitForTimeout(250);
check((await page.locator(".top-btn.adult").count()) === 1, "さらに戻ると成人／小児の選択へ");
await page.locator('.navkey:has-text("ホーム")').click();
await page.waitForTimeout(250);
check((await page.locator(".opening-art").count()) === 1, "ホームでオープニングへ戻る");

/* ---- 小児の患者条件は体重のみ ---- */
console.log("\n小児の患者条件と1日投与量");
await home();
await click("内服薬");
await click("小児");
await page.locator('header button:has-text("患者条件")').click();
await page.waitForTimeout(250);
check((await page.locator("#f-weight").count()) === 1, "小児: 体重の入力欄がある");
for (const f of ["age", "sex", "height", "scr", "egfr", "rrt"]) {
  check((await page.locator(`#f-${f}`).count()) === 0, `小児: ${f} の欄を出さない`);
}

// 体重から1日投与量が出ること。
// 原典「1日20-40mg/kg（90mg/kg/dayまで）」の上限は体重あたりなので、
// 20kg なら 400-800mg。絶対量として扱うと 90mg に誤クリップされる。
await page.fill("#f-weight", "20");
await page.waitForTimeout(300);
await page.fill('input[aria-label="薬剤名を入力"]', "アモキシシリン");
await page.waitForTimeout(350);
await page.locator(".result").first().click();
await page.waitForTimeout(350);
const pedText = await page.locator("main").innerText();
check(/1日 400-800mg/.test(pedText), "小児: 体重20kgで1日400-800mgと換算される");
check(!/上限でクリップ/.test(pedText), "小児: 体重あたりの上限を絶対量として誤クリップしない");

await browser.close();
console.log(failures.length > 0 ? `\n失敗 ${failures.length}件` : "\n画面構成: 全て合格");
process.exit(failures.length > 0 ? 1 : 0);
