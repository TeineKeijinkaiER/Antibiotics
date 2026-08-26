#!/usr/bin/env node
/**
 * アンチバイオグラム 目視照合用チェックシート生成
 *
 * 原典 p.70-71 の表とまったく同じ列順・行順で印刷用HTMLを出力する。
 * 原本（PDF or 冊子）と並べて1行ずつ目で追えるようにするのが目的。
 *
 *   node scripts/make-checksheet.mjs > checksheet.html
 *   # ブラウザで開いて印刷（A4横・余白なし推奨）
 *
 * 算術整合チェック（check-antibiogram-consistency.mjs）で裏が取れている行と、
 * 取れていない行を色分けする。後者が目視で最も重要な確認対象になる。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const antibiogram = JSON.parse(readFileSync(join(root, "src/data/antibiogram.json"), "utf8"));
const organisms = JSON.parse(readFileSync(join(root, "src/data/organisms.json"), "utf8"));

const ORG = new Map(organisms.map((o) => [o.id, o]));

/**
 * 加重平均で相互検証できている菌（check-antibiogram-consistency.mjs の GROUPS と対応）。
 * ここに無い菌は目視でしか確認できない。
 */
const ARITHMETICALLY_CHECKED = new Set([
  "e_coli", "e_coli_esbl", "e_coli_total",
  "k_pneumoniae", "k_pneumoniae_esbl", "k_pneumoniae_total",
  "k_oxytoca", "k_oxytoca_esbl", "k_oxytoca_total",
  "p_mirabilis", "p_mirabilis_esbl", "p_mirabilis_total",
  "mssa", "mrsa", "s_aureus_total",
  "msse", "mrse", "s_epidermidis_total",
]);

/** 菌数から作れない感性率＝被検株数が菌数と異なる可能性がある（要確認セル） */
function isImpossiblePct(isolates, pct) {
  if (!isolates || isolates > 50) return false;
  const step = 100 / isolates;
  return Math.abs(Math.round(pct / step) * step - pct) > 1.0;
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function section(setting, gramFilter, columns, title, page) {
  const rows = antibiogram.rows.filter((r) => {
    if (r.setting !== setting) return false;
    const gram = ORG.get(r.organismId)?.gramStain;
    return gramFilter === "gpc"
      ? gram === "gram_positive_coccus"
      : gram !== "gram_positive_coccus";
  });

  const head = `
    <tr>
      <th class="name">菌名</th>
      <th class="n">菌数</th>
      ${columns.map((c) => `<th class="abx">${esc(c)}</th>`).join("")}
      <th class="note">注記</th>
      <th class="chk">✓</th>
      <th class="fix">訂正</th>
    </tr>`;

  const body = rows
    .map((r) => {
      const org = ORG.get(r.organismId);
      const focus = !ARITHMETICALLY_CHECKED.has(r.organismId);
      const cells = columns
        .map((c) => {
          const v = r.susceptibility[c];
          if (v == null) return `<td class="v empty"></td>`;
          const flag = isImpossiblePct(r.isolates, v) ? " flag" : "";
          return `<td class="v${flag}">${v}</td>`;
        })
        .join("");
      return `
    <tr class="${focus ? "focus" : ""}">
      <td class="name">${esc(org?.scientificName ?? r.organismId)}<br><span class="ja">${esc(org?.japaneseName ?? "")}</span></td>
      <td class="n">${r.isolates}</td>
      ${cells}
      <td class="note">${esc((r.annotations ?? []).join(" / "))}</td>
      <td class="chk"></td>
      <td class="fix"></td>
    </tr>`;
    })
    .join("");

  return `
  <section>
    <h2>${esc(title)} <span class="page">原典 p.${page}</span></h2>
    <table>
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
}

const meta = antibiogram.meta;

const settings = [
  { key: "inpatient", label: "入院", page: 70 },
  { key: "outpatient", label: "外来", page: 71 },
];

const pages = settings
  .map(
    (s) => `
<article class="sheet">
  <header>
    <h1>${esc(meta.facility)}　${esc(meta.year)} アンチバイオグラム（${s.label}）目視照合シート</h1>
    <div class="sub">
      ${esc(meta.period)}　主要検出菌薬剤感受性率（検出株のうち感受性あり「S」の割合）
      <br>アプリ収載値を印字しています。原本と1セルずつ照合し、一致した行の「✓」欄にチェック、相違があれば「訂正」欄に正しい値を記入してください。
    </div>
    <div class="legend">
      <span class="k focus-k"></span> 算術整合チェックで裏が取れていない行 — <b>重点確認</b>
      <span class="k plain-k"></span> 加重平均で相互検証済みの行
      <span class="k flag-k"></span> 菌数から作れない値 — 被検株数（分母）を確認
      <span class="k empty-k"></span> 空欄＝データなし（0%ではない）
    </div>
    <div class="signoff">
      照合日 <span class="line"></span>　照合者 <span class="line"></span>　確認者 <span class="line"></span>
    </div>
  </header>
  ${section(s.key, "gnr", meta.gnrColumns, "グラム陰性桿菌・嫌気性菌", s.page)}
  ${section(s.key, "gpc", meta.gpcColumns, "グラム陽性球菌", s.page)}
  <footer>
    ${esc(meta.note)}
  </footer>
</article>`,
  )
  .join("");

process.stdout.write(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>アンチバイオグラム目視照合シート</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #fff; color: #111;
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif;
    font-size: 9px; line-height: 1.4;
  }
  .sheet { padding: 10px 12px; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  h1 { font-size: 14px; margin: 0 0 4px; }
  .sub { font-size: 9px; color: #444; margin-bottom: 6px; }
  .legend { font-size: 8.5px; color: #333; margin-bottom: 6px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
  .k { display: inline-block; width: 12px; height: 12px; border: 1px solid #888; vertical-align: -2px; margin-right: 4px; }
  .focus-k { background: #fdf0d5; border-left: 2px solid #c98a1e; }
  .plain-k { background: #fff; }
  .flag-k { background: #fde2dc; border-color: #b04030; }
  .empty-k { background: #e8e8e8; }
  .signoff { font-size: 9px; margin-bottom: 8px; }
  .signoff .line { display: inline-block; width: 90px; border-bottom: 1px solid #333; }
  h2 { font-size: 11px; margin: 8px 0 3px; border-bottom: 1.5px solid #111; padding-bottom: 2px; }
  h2 .page { font-size: 9px; font-weight: 400; color: #555; margin-left: 6px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 0.5px solid #999; padding: 1.5px 2px; text-align: center; }
  thead th { background: #eceeee; font-size: 8.5px; }
  th.name, td.name { width: 128px; text-align: left; font-size: 8px; }
  td.name .ja { color: #555; font-size: 7.5px; }
  th.n, td.n { width: 30px; font-variant-numeric: tabular-nums; }
  th.abx, td.v { width: auto; font-variant-numeric: tabular-nums; }
  td.v { font-weight: 600; }
  td.v.empty { background: #eee; }
  td.v.flag { background: #fde2dc; }
  th.note, td.note { width: 96px; text-align: left; font-size: 7.5px; }
  th.chk, td.chk { width: 22px; }
  th.fix, td.fix { width: 76px; }
  tr.focus td { background: #fffaf0; }
  tr.focus td.name, tr.focus td.n { background: #fdf0d5; }
  tr.focus td.name { border-left: 2px solid #c98a1e; }
  tr.focus td.v.empty { background: #ece7dd; }
  tr.focus td.v.flag { background: #fde2dc; }
  footer { margin-top: 8px; font-size: 7.5px; color: #555; }
  @media screen {
    body { background: #f0f2f2; padding: 16px; }
    .sheet { background: #fff; max-width: 1100px; margin: 0 auto 16px; box-shadow: 0 2px 12px rgba(0,0,0,.15); }
  }
</style>
</head>
<body>
${pages}
</body>
</html>
`);
