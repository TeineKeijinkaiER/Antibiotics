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
// FR-000-2 / FR-017-1: 感染症別を加えて5ボタン
check((await page.locator(".top-btn").count()) === 5, "大項目は5ボタン");
const tops = await page.locator(".top-btn").allInnerTexts();
for (const label of ["内服薬", "注射薬", "菌種別", "感染症別", "その他"]) {
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
// 手引きの表集を加えて5ボタン
check((await page.locator(".top-btn").count()) === 5, "その他は5ボタン");
const others = await page.locator(".top-btn").allInnerTexts();
for (const label of [
  "周術期",
  "暴露後予防投与",
  "小児体重服用量簡易表",
  "AMR対策",
  "適正使用の手引き（表集）",
]) {
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
  (await page.locator('.contextbar button:has-text("患者条件")').count()) > 0;

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
await page.locator('.contextbar button:has-text("患者条件")').click();
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

/* ---- 「1回◯mgまで」の分割回数の適用（divisionsPerDay） ---- */
console.log("\n「1回◯mgまで」の自動計算（分割回数）");

// リネゾリド 30mg/kg/day 分3（1回600mgまで）
// 25kg: 750mg/day ÷3 = 250mg/回。上限未満なのでクリップなし
await openDrug("注射薬", "小児", "リネゾリド");
await page.locator('.contextbar button:has-text("患者条件")').click();
await page.fill("#f-weight", "25");
await page.waitForTimeout(300);
await page.locator('.contextbar button:has-text("患者条件")').click();
await page.waitForTimeout(150);
let doseText = await page.locator("main").innerText();
check(/1日 750mg/.test(doseText), "リネゾリド25kg: 1日750mgと換算される");
check(/1回 250mg を1日3回/.test(doseText), "リネゾリド25kg: 1回250mg×3回の内訳が出る");
check(!/上限でクリップ/.test(doseText), "リネゾリド25kg: 上限未満なのでクリップされない");

// 70kg: 2100mg/day ÷3 = 700mg/回 → 600mgでクリップ。見出しの1日量も 600×3=1800mg に整合させる
await openDrug("注射薬", "小児", "リネゾリド");
await page.locator('.contextbar button:has-text("患者条件")').click();
await page.fill("#f-weight", "70");
await page.waitForTimeout(300);
await page.locator('.contextbar button:has-text("患者条件")').click();
await page.waitForTimeout(150);
doseText = await page.locator("main").innerText();
check(/1回 600mg を1日3回/.test(doseText), "リネゾリド70kg: 1回量が600mgの上限でクリップされる");
check(
  /1日 1800mg/.test(doseText),
  "リネゾリド70kg: 見出しの1日量も、クリップ後の1回量×回数(1800mg)に整合する",
);
check(/1回量の上限でクリップ/.test(doseText), "リネゾリド70kg: 1回量の上限でクリップした旨の注記がある");

/* ---- その他（AWaRe分類対象外）のジャンル分け ---- */
console.log("\nその他（AWaRe分類対象外）のジャンル分け");
await home();
await click("内服薬");
await click("成人");
await click("その他");
await page.waitForTimeout(250);
const genreButtons = await page.locator(".top-btn").allInnerTexts();
for (const label of ["抗真菌薬", "抗ウイルス薬", "抗結核薬", "駆虫薬"]) {
  check(genreButtons.some((t) => t.includes(label)), `ジャンルボタンに「${label}」がある`);
}
await click("抗真菌薬");
check((await page.locator(".result").count()) > 0, "ジャンルを選ぶと薬剤名が一覧される");
const genreListText = await page.locator("main").innerText();
check(/フルコナゾール|ボリコナゾール/.test(genreListText), "選んだジャンルの薬剤が含まれる");
check(!/オセルタミビル/.test(genreListText), "他ジャンルの薬剤は含まれない");

/* ---- 小児ではTDM画面を出さない ---- */
console.log("\n小児ではTDM画面を出さない");
await openDrug("注射薬", "小児", "バンコマイシン");
check(
  (await page.locator('button:has-text("TDM対象")').count()) === 0,
  "小児の薬剤詳細にTDM対象バッジを出さない",
);
check(
  /TDM投与設計は成人を対象/.test(await page.locator("main").innerText()),
  "小児の薬剤詳細にTDMは成人向けである旨を出す",
);

await openDrug("注射薬", "成人", "バンコマイシン");
check(
  (await page.locator('button:has-text("TDM対象")').count()) === 1,
  "成人の薬剤詳細にはTDM対象バッジを出す",
);
await click("TDM対象");
check((await page.locator("#tdm-first").count()) === 1, "成人ではTDM投与設計画面が開く");

// ヘッダーから集団を切り替えた場合も、その場でTDM画面を止める
await page.locator('.contextbar button:has-text("小児に切替")').click();
await page.waitForTimeout(300);
check(
  /TDM投与設計は成人を対象/.test(await page.locator("main").innerText()),
  "TDM画面表示中に小児へ切り替えると成人向けの案内に切り替わる",
);
check((await page.locator("#tdm-first").count()) === 0, "小児では投与設計フォームを表示しない");

/* ---- 感染症別（FR-017） ---- */
console.log("\n感染症別");
await home();
const topsWithInfection = await page.locator(".top-btn").allInnerTexts();
check(
  topsWithInfection.some((t) => t.trim() === "感染症別"),
  "大項目に「感染症別」がある",
);

await click("感染症別");
await click("成人");

// FR-100-5: 感染症名で引いたら、その感染症のことが1画面に集まっている
await page.fill('input[aria-label="感染症名を入力"]', "院内");
await page.waitForTimeout(300);
check((await page.locator(".result").count()) > 0, "感染症名で検索できる");
await page.locator(".result").first().click();
await page.waitForTimeout(350);
let infText = await page.locator("main").innerText();
check(/緑膿菌/.test(infText), "院内発症感染症に表2の原因微生物が出る");
check(
  /第一選択薬の記載はありません/.test(infText),
  "原典に推奨薬がない場合はその旨を明示する（欄を空にしない）",
);

// 院内発症の表を市中発症に当てはめさせない（表2は院内発症のみを対象とする）
check(
  /市中発症の感染症とは想定する原因微生物が異なる/.test(infText),
  "院内発症の表であることを明示する",
);
// 治療期間（表5）は市中の病態も含むため、この画面には混ぜない
check(!/3〜5日間/.test(infText), "院内発症のページに市中を含む治療期間の表を混ぜない");

// FR-017-5: 菌名から菌種別画面（＝アンチバイオグラム）へ
const firstOrganism = (await page.locator(".chip-link").first().innerText()).replace(/\s*→$/, "");
await page.locator(".chip-link").first().click();
await page.waitForTimeout(350);
check(
  (await page.locator("h2").first().innerText()).includes(firstOrganism),
  "菌名から菌種別画面へ遷移する",
);
check(
  (await page.locator("table.abx").count()) > 0,
  "遷移先で当院のアンチバイオグラムを確認できる",
);
await click("← 戻る");

// FR-017-5: 薬剤名から薬剤詳細へ
await home();
await click("感染症別");
await click("成人");
await click("気道・耳鼻科");
await click("急性鼻副鼻腔炎");
check((await page.locator(".rx-link").count()) > 0, "推奨薬が薬剤詳細へのリンクになっている");
await page.locator(".rx-link").first().click();
await page.waitForTimeout(350);
check(
  /アモキシシリン/.test(await page.locator("h2").first().innerText()),
  "薬剤名から当院の薬剤詳細へ遷移する",
);
await click("← 戻る");

// FR-000-7: 成人と小児の用量を同一画面に並べない
infText = await page.locator("main").innerText();
check(/1回 500mg 1日3回 経口（成人）/.test(infText), "成人では成人の用量を出す");
check(!/分3〜4/.test(infText), "成人の画面に小児の用量を出さない");
check(!/小児の遷延性/.test(infText), "成人の画面に小児向けの判定表を出さない");

await page.locator('.contextbar button:has-text("小児に切替")').click();
await page.waitForTimeout(350);
infText = await page.locator("main").innerText();
check(/分3〜4/.test(infText), "小児に切り替えると小児の用量を出す");
check(!/1回 500mg 1日3回 経口（成人）/.test(infText), "小児の画面に成人の用量を出さない");
check(/遷延性/.test(infText), "小児では小児向けの判定表を出す");

// FR-100-2/FR-100-4: 数値は畳んで置くが、失われてはいない
await home();
await click("感染症別");
await click("成人");
await click("気道・耳鼻科");
await click("感冒");
infText = await page.locator("main").innerText();
check(/抗菌薬投与を行わないことを推奨/.test(infText), "「投与しない」推奨を結論として出す");
check(!/嘔吐・下痢・皮疹/.test(infText), "根拠の数値は初期表示では畳まれている");
await page.locator("summary").first().click();
await page.waitForTimeout(250);
check(/2.62倍/.test(await page.locator("main").innerText()), "開くと数値が読める");

/* ---- 手引きの表集（その他） ---- */
console.log("\n適正使用の手引き（表集）");
await home();
await click("その他");
check(
  (await page.locator(".top-btn").allInnerTexts()).some((t) =>
    t.includes("適正使用の手引き"),
  ),
  "「その他」に手引きの表集がある",
);
await click("適正使用の手引き（表集）");
for (const label of ["血液培養の解釈", "治療期間の早見表", "経口薬への切り替え"]) {
  check(
    (await page.locator(".top-btn").allInnerTexts()).some((t) => t.includes(label)),
    `表集に「${label}」がある`,
  );
}
await click("治療期間の早見表");
const topicText = await page.locator("main").innerText();
check(/椎体椎間板炎/.test(topicText), "疾患ページに載らない行も表として残っている");
check(/6週間/.test(topicText), "治療期間の数値が出る");

await browser.close();
console.log(failures.length > 0 ? `\n失敗 ${failures.length}件` : "\n画面構成: 全て合格");
process.exit(failures.length > 0 ? 1 : 0);
