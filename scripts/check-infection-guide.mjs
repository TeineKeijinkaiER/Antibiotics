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

const browser = await chromium.launch({ executablePath: EXEC });
const context = await browser.newContext({ viewport: { width: 900, height: 1000 } });
await context.addInitScript(() => localStorage.setItem("abx-navi/disclaimer-acknowledged/v1", "1"));
const page = await context.newPage();
const click = async (text) => {
  await page.locator(`button:has-text("${text}")`).first().click();
  await page.waitForTimeout(180);
};

console.log("感染症別の入口と成人・小児");
await page.goto(BASE, { waitUntil: "networkidle" });
await click("感染症別");
check((await page.locator(".top-btn").count()) === 2, "成人・小児の選択を必ず挟む");
await click("成人");
const menu = await page.locator("main").innerText();
for (const category of ["気道・耳鼻科", "消化器", "皮膚軟部組織", "院内発症感染症"]) {
  check(menu.includes(category), `カテゴリ「${category}」が表示される`);
}

console.log("\n成人の急性下痢症");
await click("消化器");
await click("急性下痢症");
let text = await page.locator("main").innerText();
check(/主な病原体の潜伏期間/.test(text), "潜伏期間表がある");
check((await page.locator("table.doc tbody tr").count()) === 11, "潜伏期間表は11行");
check(/抗菌薬を検討する状況/.test(text), "抗菌薬の適応を本文で説明する");
check(/疾患メモ/.test(text), "見出しを疾患メモとする");
check(!/判断の根拠となる数値/.test(text), "旧見出しを表示しない");
check(!/抗菌薬を出さない|条件付きで出す/.test(text), "色付き判断タグの文言を表示しない");
check(/抗微生物薬適正使用の手引き 第四版/.test(text), "第四版の出典を表示する");

console.log("\n小児の急性下痢症");
await page.goto(BASE, { waitUntil: "networkidle" });
await click("感染症別");
await click("小児");
await click("消化器");
await click("急性下痢症");
text = await page.locator("main").innerText();
check(/脱水/.test(text) && /生後3か月未満/.test(text), "小児固有の評価・抗菌薬条件がある");
check(!/50歳以上/.test(text), "成人固有の抗菌薬条件を小児画面に混在させない");

console.log("\n院内発症感染症");
await page.goto(BASE, { waitUntil: "networkidle" });
await click("感染症別");
await click("成人");
await click("院内発症感染症");
await click("院内発症感染症");
text = await page.locator("main").innerText();
check(/市中感染へ外挿しない/.test(text), "院内発症に限定する注意がある");
check(!/短期治療期間/.test(text), "市中・院内混在の投与期間を載せない");
check((await page.locator(".chip-link").count()) > 0, "微生物からアンチバイオグラムへの導線がある");
await page.locator(".chip-link").first().click();
await page.waitForTimeout(200);
check(/感性率|データは原典にありません/.test(await page.locator("main").innerText()), "菌詳細へ遷移する");

await browser.close();
console.log(failures.length ? `\n失敗 ${failures.length}件` : "\n感染症別: 全て合格");
process.exit(failures.length ? 1 : 0);
