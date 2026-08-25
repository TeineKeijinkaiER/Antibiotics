#!/usr/bin/env node
/**
 * アンチバイオグラム 自己整合チェック
 *
 * 原データ（Excel）が無くても実行できる検証。
 * total行は「非産生株行」と「ESBL産生株行（あるいはMRSA/MRSE行）」の
 * 検出株数による加重平均で説明できるはずである、という関係を使い、
 * 列の対応がずれていないかを検出する。
 *
 *   予測値 = (n_a × S_a + n_b × S_b) ÷ n_total
 *
 * 例：S. aureus (total) の CEZ 67% は、MSSA の CEZ 100% × (1 − MRSA率 0.33) と一致する。
 * ずれが許容誤差を超える列は、列の取り違えかデータの誤りを疑う。
 *
 * 使い方: node scripts/check-antibiogram-consistency.mjs [--tolerance 1.5]
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const antibiogram = JSON.parse(
  readFileSync(join(root, "src/data/antibiogram.json"), "utf8"),
);
const organisms = JSON.parse(
  readFileSync(join(root, "src/data/organisms.json"), "utf8"),
);

const nameOf = (id) =>
  organisms.find((o) => o.id === id)?.japaneseName ?? id;

const args = process.argv.slice(2);
const tolIndex = args.indexOf("--tolerance");
/** 許容誤差（パーセントポイント）。原典は整数に丸めた値のみを載せているため既定を 1.5 とする */
const TOLERANCE = tolIndex >= 0 ? Number(args[tolIndex + 1]) : 1.5;

/**
 * 加重平均が成り立つ組み合わせ。
 * subgroups の順に「感性率が高い側」「低い側」を並べる（表示上の都合のみ）。
 */
const GROUPS = [
  { total: "e_coli_total", subgroups: ["e_coli", "e_coli_esbl"], ratioLabel: "ESBL産生菌の割合" },
  { total: "k_pneumoniae_total", subgroups: ["k_pneumoniae", "k_pneumoniae_esbl"], ratioLabel: "ESBL産生菌の割合" },
  { total: "k_oxytoca_total", subgroups: ["k_oxytoca", "k_oxytoca_esbl"], ratioLabel: "ESBL又はK1型BL産生菌の割合" },
  { total: "p_mirabilis_total", subgroups: ["p_mirabilis", "p_mirabilis_esbl"], ratioLabel: "ESBL産生菌の割合" },
  { total: "s_aureus_total", subgroups: ["mssa", "mrsa"], ratioLabel: "MRSAの割合" },
  { total: "s_epidermidis_total", subgroups: ["msse", "mrse"], ratioLabel: "MRSEの割合" },
];

const rowOf = (organismId, setting) =>
  antibiogram.rows.find((r) => r.organismId === organismId && r.setting === setting);

const problems = [];
const checked = { cells: 0, groups: 0 };

function parseRatio(annotations, label) {
  for (const a of annotations ?? []) {
    if (!a.includes(label)) continue;
    const m = a.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) return Number(m[1]) / 100;
  }
  return null;
}

for (const setting of ["inpatient", "outpatient"]) {
  const settingLabel = setting === "inpatient" ? "入院" : "外来";

  for (const group of GROUPS) {
    const total = rowOf(group.total, setting);
    const [a, b] = group.subgroups.map((id) => rowOf(id, setting));
    if (!total || !a || !b) continue;
    checked.groups++;

    const where = `${settingLabel} ${nameOf(group.total)}`;

    // 1. 株数の整合
    if (a.isolates + b.isolates !== total.isolates) {
      problems.push({
        severity: "error",
        where,
        detail: `株数が合いません — ${nameOf(a.organismId)} ${a.isolates} + ${nameOf(b.organismId)} ${b.isolates} = ${a.isolates + b.isolates} ≠ total ${total.isolates}`,
      });
    }

    // 2. 注記の割合と株数比の整合
    const stated = parseRatio(total.annotations, group.ratioLabel);
    if (stated != null && total.isolates > 0) {
      const actual = b.isolates / total.isolates;
      const diffPt = Math.abs(stated - actual) * 100;
      if (diffPt > 1.0) {
        problems.push({
          severity: "error",
          where,
          detail: `注記の割合が株数比と合いません — 注記 ${(stated * 100).toFixed(0)}% / 株数比 ${(actual * 100).toFixed(1)}%`,
        });
      }
    }

    if (total.isolates === 0) continue;

    // 3. 各抗菌薬列の加重平均
    const columns = new Set([
      ...Object.keys(total.susceptibility),
      ...Object.keys(a.susceptibility),
      ...Object.keys(b.susceptibility),
    ]);

    for (const abx of columns) {
      const sTotal = total.susceptibility[abx];
      if (sTotal == null) {
        // total に無いのに部分集団にある = 列の取り違えの可能性
        if (a.susceptibility[abx] != null && a.isolates > 0) {
          problems.push({
            severity: "warn",
            where,
            detail: `${abx}: total に値が無いのに ${nameOf(a.organismId)} には ${a.susceptibility[abx]}% がある`,
          });
        }
        continue;
      }

      // 部分集団に値が無い列は「その集団では 0%（耐性）」として扱う。
      // ESBL産生株のβ-ラクタム、MRSAのCEZ は定義上耐性であり空欄になるため。
      const sA = a.susceptibility[abx] ?? 0;
      const sB = b.susceptibility[abx] ?? 0;
      const predicted = (a.isolates * sA + b.isolates * sB) / total.isolates;
      const diff = Math.abs(predicted - sTotal);
      checked.cells++;

      if (diff > TOLERANCE) {
        problems.push({
          severity: "error",
          where,
          detail:
            `${abx}: total ${sTotal}% だが加重平均は ${predicted.toFixed(1)}%（差 ${diff.toFixed(1)}pt）` +
            `　内訳 ${nameOf(a.organismId)} ${a.susceptibility[abx] ?? "空欄→0"}% ×${a.isolates}株 / ` +
            `${nameOf(b.organismId)} ${b.susceptibility[abx] ?? "空欄→0"}% ×${b.isolates}株`,
        });
      }
    }
  }
}

/* ---------- 全行に共通する健全性チェック ---------- */

for (const row of antibiogram.rows) {
  const settingLabel = row.setting === "inpatient" ? "入院" : "外来";
  const where = `${settingLabel} ${nameOf(row.organismId)}`;

  // 感性率が「菌数分の整数」で説明できるかを見る。
  // 説明できない場合、その抗菌薬の被検株数が菌数と異なる（＝全株で測定されていない）
  // 可能性が高い。誤りとは限らないため、突合時の確認事項として warn で挙げる。
  if (row.isolates > 0 && row.isolates <= 50) {
    for (const [abx, pct] of Object.entries(row.susceptibility)) {
      const step = 100 / row.isolates;
      const nearest = Math.round(pct / step) * step;
      if (Math.abs(nearest - pct) > 1.0) {
        problems.push({
          severity: "warn",
          where,
          detail:
            `${abx}: ${pct}% は菌数 ${row.isolates}株では作れない値です` +
            `（${step.toFixed(1)}%刻み。最も近いのは ${nearest.toFixed(1)}%）。` +
            `この抗菌薬の被検株数が菌数と異なる可能性があるため、原データで分母を確認すること`,
        });
      }
    }
  }
}

/* ---------- 出力 ---------- */

const errors = problems.filter((p) => p.severity === "error");
const warns = problems.filter((p) => p.severity === "warn");

console.log(
  `アンチバイオグラム自己整合チェック（許容誤差 ±${TOLERANCE}pt）\n` +
    `  検証した組: ${checked.groups} ／ 検証したセル: ${checked.cells}\n`,
);

for (const p of warns) console.warn(`  warn  [${p.where}] ${p.detail}`);
if (warns.length > 0) console.log("");

if (errors.length > 0) {
  console.error(`${errors.length} 件の不整合:`);
  for (const p of errors) console.error(`  error [${p.where}] ${p.detail}`);
  console.error(
    "\n不整合のある列は、PDFからの列対応の取り違えか、データの転記ミスを疑ってください。",
  );
  process.exit(1);
}

console.log(`整合OK — 不整合 0 件 / 注意 ${warns.length} 件`);
console.log(
  "\n注意：本チェックは total 行を持つ菌にしか適用できません。" +
    "\ntotal 行のない菌（緑膿菌、アシネトバクター、腸球菌、レンサ球菌ほか）は" +
    "\n原データ（Excel）との突合でしか検証できません。scripts/diff-antibiogram.mjs を使用してください。",
);
