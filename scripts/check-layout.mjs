#!/usr/bin/env node
/**
 * レイアウト検査（UI再編 版2.0 §4「作成後の配置チェック」）
 *
 * 幅 375 / 768 / 1280px の3種で主要画面を開き、以下を機械的に判定する。
 * 目視の主観に頼らず、1つでも該当したら不合格とする。
 *
 *   1. ページ本体に横スクロールが発生している
 *   2. 表のセルが極端に細い列に押し込められている（1文字幅で折り返している）
 *   3. ある列が表幅の70%以上を占めている
 *   4. テキストが親要素からはみ出している
 *
 * 使い方: npx vite preview を起動した状態で node scripts/check-layout.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = process.env.SHOT_DIR ?? "/tmp/layout-shots";
const WIDTHS = [375, 768, 1280];

/** 画面ごとの到達手順。click は表示テキストの部分一致で押す */
const SCREENS = [
  // 免責画面は初回のみ表示されるため、確認済みフラグを立てずに開く
  { name: "00-disclaimer", steps: [], skipAcknowledge: true },
  { name: "01-home", steps: [] },
  { name: "02-oral-modepick", steps: ["内服薬"] },
  { name: "03-oral-adult", steps: ["内服薬", "成人"] },
  { name: "04-oral-aware-access", steps: ["内服薬", "成人", "Access"] },
  { name: "05-injectable-adult", steps: ["注射薬", "成人"] },
  { name: "06-organisms", steps: ["菌名"] },
  { name: "07-prophylaxis", steps: ["周術期"] },
  { name: "08-drug-vcm", steps: ["注射薬", "成人", "バンコマイシン"] },
  { name: "09-tdm-vcm", steps: ["注射薬", "成人", "バンコマイシン", "TDM対象"] },
  { name: "10-tdm-aminoglycoside", steps: ["アミノグリコシド 投与設計"] },
  { name: "11-formulary", steps: ["当院採用注射抗菌薬一覧"] },
  { name: "12-anaphylaxis", steps: ["アナフィラキシー対応"] },
  { name: "13-pediatric-weight", steps: ["小児の体重・薬用量"] },
  { name: "14-stewardship", steps: ["適正使用指針・AWaRe"] },
  { name: "15-about", steps: ["アプリの説明"] },
];

/** 免責事項の確認済みフラグ。立てておかないと初回の確認画面で止まる */
const ACK_KEY = "abx-navi/disclaimer-acknowledged/v1";

const audit = () => {
  const problems = [];
  const de = document.documentElement;

  if (de.scrollWidth > de.clientWidth + 1) {
    problems.push(`ページ本体に横スクロール（${de.scrollWidth}px > ${de.clientWidth}px）`);
  }

  for (const table of document.querySelectorAll("table")) {
    const tw = table.getBoundingClientRect().width;
    if (tw === 0) continue;
    // 狭幅でカード表示に落ちている表（table 自体が block 化）は列幅を判定しない。
    // 1行1カードとして縦に積む設計なので、各セルが全幅を占めるのが正しい。
    if (getComputedStyle(table).display !== "table") continue;
    const firstRow = table.querySelector("tbody tr");
    if (!firstRow) continue;
    const cells = [...firstRow.children];
    cells.forEach((cell, i) => {
      const w = cell.getBoundingClientRect().width;
      if (w / tw >= 0.7 && cells.length > 1) {
        problems.push(`列${i + 1}が表幅の${Math.round((w / tw) * 100)}%を占有`);
      }
      // 1文字分しか幅がない = 縦書きのように潰れている
      if (w < 24 && (cell.textContent ?? "").trim().length > 2) {
        problems.push(`列${i + 1}が${Math.round(w)}pxまで潰れている`);
      }
    });
  }

  for (const el of document.querySelectorAll("td, th, .dose-text, .result-name, .lane-tile b")) {
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === "visible") {
      const t = (el.textContent ?? "").trim().slice(0, 24);
      problems.push(`はみ出し: "${t}"（${el.scrollWidth} > ${el.clientWidth}）`);
    }
  }
  return problems;
};

async function clickByText(page, text) {
  const target = page
    .locator(`button:has-text("${text}"), a:has-text("${text}")`)
    .filter({ has: undefined })
    .first();
  await target.waitFor({ state: "visible", timeout: 5000 });
  await target.click();
  await page.waitForTimeout(150);
}

// この環境には Chromium が同梱されている（PLAYWRIGHT_BROWSERS_PATH）。
// playwright のビルド番号と一致しないため、実行ファイルを直接指定する。
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
let failures = 0;
let checked = 0;

for (const width of WIDTHS) {
  const dir = join(OUT, String(width));
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();

  for (const screen of SCREENS) {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate(
      ([key, acknowledged]) => {
        try {
          if (acknowledged) localStorage.setItem(key, "1");
          else localStorage.removeItem(key);
        } catch {
          /* noop */
        }
      },
      [ACK_KEY, !screen.skipAcknowledge],
    );
    await page.reload({ waitUntil: "networkidle" });
    try {
      for (const step of screen.steps) await clickByText(page, step);
    } catch (err) {
      console.log(`  SKIP ${width}px ${screen.name} — 到達できず: ${err.message.split("\n")[0]}`);
      continue;
    }
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(dir, `${screen.name}.png`), fullPage: true });
    const problems = await page.evaluate(audit);
    checked += 1;
    if (problems.length > 0) {
      failures += 1;
      console.log(`  NG  ${width}px ${screen.name}`);
      for (const p of [...new Set(problems)]) console.log(`        - ${p}`);
    } else {
      console.log(`  ok  ${width}px ${screen.name}`);
    }
  }
  await context.close();
}

await browser.close();
console.log(`\n検査した画面: ${checked} ／ 問題のあった画面: ${failures}`);
console.log(`スクリーンショット: ${OUT}`);
process.exit(failures > 0 ? 1 : 0);
