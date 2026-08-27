#!/usr/bin/env node
/**
 * データ品質ゲート（要件 NFR-008 / データモデル設計 §10）
 *
 *  - 全レコードに source.pages が存在すること
 *  - dose.perKg に weightBasis（basis）が存在すること
 *  - 感受性率が 0–100 の整数であること
 *  - ID の参照切れがないこと（OffLabelUse → Drug / Disease、Antibiogram → Organism）
 *  - ID の重複がないこと
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => JSON.parse(readFileSync(join(root, "src/data", p), "utf8"));

const drugs = [
  ...load("drugs.betalactam.json"),
  ...load("drugs.antibacterial.json"),
  ...load("drugs.antifungal-antiviral.json"),
];
const organisms = load("organisms.json");
const diseases = load("diseases.json");
const offlabel = load("offlabel.json");
const antibiogram = load("antibiogram.json");
const prophylaxis = load("prophylaxis.json");
const reference = load("reference.json");

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/* ---------- source ---------- */

function checkSource(source, where) {
  if (!source) return fail(`${where}: source がありません`);
  if (typeof source.edition !== "number") fail(`${where}: source.edition がありません`);
  if (!Array.isArray(source.pages) || source.pages.length === 0) {
    fail(`${where}: source.pages がありません（原典ページ番号は必須）`);
  } else if (source.pages.some((p) => !Number.isInteger(p) || p < 1 || p > 200)) {
    fail(`${where}: source.pages に不正なページ番号があります (${source.pages})`);
  }
}

/* ---------- 一意性 ---------- */

function checkUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item.id) fail(`${label}: id のないレコードがあります`);
    else if (seen.has(item.id)) fail(`${label}: id が重複しています — ${item.id}`);
    seen.add(item.id);
  }
  return seen;
}

const drugIds = checkUniqueIds(drugs, "Drug");
const organismIds = checkUniqueIds(organisms, "Organism");
const diseaseIds = checkUniqueIds(diseases, "Disease");
checkUniqueIds(offlabel, "OffLabelUse");

/* ---------- Drug ---------- */

const VALID_CATEGORY = new Set([
  "antibacterial", "antifungal", "antiviral", "antituberculous", "anthelmintic",
]);
const VALID_BASIS = new Set(["actual", "ideal", "adjusted"]);
const VALID_BAND = new Set(["gt50", "ccr10_50", "lt10", "hd", "chdf"]);
const VALID_ROUTE = new Set(["iv", "po", "im", "inhalation"]);

for (const drug of drugs) {
  const where = `Drug(${drug.id})`;
  checkSource(drug.source, where);

  if (!drug.genericName?.en || !drug.genericName?.ja) fail(`${where}: genericName が不完全です`);
  if (!VALID_CATEGORY.has(drug.category)) fail(`${where}: category が不正です — ${drug.category}`);
  if (!drug.class) fail(`${where}: class がありません`);

  for (const population of ["adult", "pediatric"]) {
    const routes = drug[population];
    if (!routes) continue;
    for (const [route, doses] of Object.entries(routes)) {
      if (!VALID_ROUTE.has(route)) fail(`${where}.${population}: route が不正です — ${route}`);
      if (!Array.isArray(doses) || doses.length === 0) {
        fail(`${where}.${population}.${route}: 用量が空です`);
        continue;
      }
      doses.forEach((dose, i) => {
        const dw = `${where}.${population}.${route}[${i}]`;
        if (!dose.text) fail(`${dw}: text がありません`);
        if (!("indication" in dose)) fail(`${dw}: indication がありません（一般量は null を明示）`);
        if (dose.perKg) {
          // データモデル §10 の品質ゲート：mg/kg 用量には体重基準が必須
          if (!VALID_BASIS.has(dose.perKg.basis)) {
            fail(`${dw}: perKg.basis が不正です — ${dose.perKg.basis}`);
          }
          if (!["perDose", "perDay"].includes(dose.perKg.per)) {
            fail(`${dw}: perKg.per が不正です — ${dose.perKg.per}`);
          }
          const amounts = Array.isArray(dose.perKg.amount) ? dose.perKg.amount : [dose.perKg.amount];
          if (amounts.some((a) => typeof a !== "number" || a <= 0)) {
            fail(`${dw}: perKg.amount が不正です`);
          }
        }
      });
    }
  }

  for (const key of ["renal", "renalPo"]) {
    if (!drug[key]) continue;
    for (const band of Object.keys(drug[key])) {
      if (!VALID_BAND.has(band)) fail(`${where}.${key}: 腎機能区分が不正です — ${band}`);
    }
  }

  if (drug.tdm) {
    checkSource(drug.tdm.source, `${where}.tdm`);
    if (drug.tdm.designer && !["vancomycin", "teicoplanin", "aminoglycoside", "voriconazole"].includes(drug.tdm.designer)) {
      fail(`${where}.tdm: designer が不正です — ${drug.tdm.designer}`);
    }
  }

  for (const [i, f] of (drug.formulations ?? []).entries()) {
    checkSource(f.source, `${where}.formulations[${i}]`);
    if (!f.brandName || !f.strength) fail(`${where}.formulations[${i}]: brandName/strength がありません`);
  }

  if (!drug.adult && !drug.pediatric) warn(`${where}: 成人・小児いずれの用量もありません`);
}

/* ---------- Organism ---------- */

const VALID_GRAM = new Set(["gram_positive_coccus", "gram_negative_rod", "anaerobe"]);
for (const o of organisms) {
  const where = `Organism(${o.id})`;
  if (!o.scientificName) fail(`${where}: scientificName がありません`);
  if (!o.japaneseName) fail(`${where}: japaneseName がありません`);
  if (!VALID_GRAM.has(o.gramStain)) fail(`${where}: gramStain が不正です — ${o.gramStain}`);
  if (!Array.isArray(o.aliases) || o.aliases.length === 0) {
    warn(`${where}: aliases が空です（複数表記での検索ができません）`);
  }
}

/* ---------- Disease ---------- */

for (const d of diseases) {
  if (!d.name) fail(`Disease(${d.id}): name がありません`);
  if (!Array.isArray(d.aliases)) fail(`Disease(${d.id}): aliases が配列ではありません`);
}

/* ---------- OffLabelUse ---------- */

const VALID_OFFLABEL_CATEGORY = new Set(["indication", "indication_and_dosage", "dosage"]);
for (const use of offlabel) {
  const where = `OffLabelUse(${use.id})`;
  checkSource(use.source, where);
  if (!drugIds.has(use.drugId)) fail(`${where}: drugId の参照切れ — ${use.drugId}`);
  if (!VALID_OFFLABEL_CATEGORY.has(use.category)) fail(`${where}: category が不正です — ${use.category}`);
  if (!use.productLabel) fail(`${where}: productLabel がありません`);
  if (!Array.isArray(use.diseaseIds) || use.diseaseIds.length === 0) {
    fail(`${where}: diseaseIds が空です`);
  }
  for (const id of use.diseaseIds ?? []) {
    if (!diseaseIds.has(id)) fail(`${where}: diseaseId の参照切れ — ${id}`);
  }
}

/* ---------- Antibiogram ---------- */

checkSource(antibiogram.meta?.source, "Antibiogram.meta");
if (antibiogram.meta?.verified !== true && !antibiogram.meta?.verificationNote) {
  fail("Antibiogram.meta: verified が false のときは verificationNote が必須です");
}
if (antibiogram.meta?.verified !== true) {
  warn("Antibiogram: 原データ（Excel）との突合が未了です。院内公開前に検証が必要です。");
}

const knownColumns = new Set([
  ...(antibiogram.meta?.gnrColumns ?? []),
  ...(antibiogram.meta?.gpcColumns ?? []),
]);
const seenRows = new Set();

for (const row of antibiogram.rows ?? []) {
  const where = `Antibiogram(${row.organismId}/${row.setting})`;
  checkSource(row.source, where);
  if (!organismIds.has(row.organismId)) fail(`${where}: organismId の参照切れ — ${row.organismId}`);
  if (!["inpatient", "outpatient"].includes(row.setting)) fail(`${where}: setting が不正です`);
  const key = `${row.organismId}/${row.setting}`;
  if (seenRows.has(key)) fail(`${where}: 同一の菌・区分の行が重複しています`);
  seenRows.add(key);

  if (!Number.isInteger(row.isolates) || row.isolates < 0) fail(`${where}: isolates が不正です`);

  for (const [abx, pct] of Object.entries(row.susceptibility ?? {})) {
    if (!knownColumns.has(abx)) fail(`${where}: 未知の抗菌薬列 — ${abx}`);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      fail(`${where}: ${abx} の感性率が 0–100 の整数ではありません — ${pct}`);
    }
  }
  if (row.isolates === 0 && Object.keys(row.susceptibility ?? {}).length > 0) {
    fail(`${where}: 0株なのに感性率が入っています`);
  }
}

/* ---------- 周術期予防抗菌薬 ---------- */

checkSource(prophylaxis.meta?.source, "Prophylaxis.meta");
for (const w of prophylaxis.woundClasses ?? []) {
  checkSource(w.source, `WoundClass(${w.id})`);
  if (!w.label || !w.indication || !w.criteria) fail(`WoundClass(${w.id}): 項目が不足しています`);
}
checkUniqueIds(prophylaxis.entries ?? [], "ProphylaxisEntry");
for (const e of prophylaxis.entries ?? []) {
  const where = `ProphylaxisEntry(${e.id})`;
  checkSource(e.source, where);
  if (![1, 2, 3].includes(e.targetGroup)) fail(`${where}: targetGroup が不正です — ${e.targetGroup}`);
  if (!prophylaxis.targetGroupLabels?.[String(e.targetGroup)]) {
    fail(`${where}: targetGroupLabels に ${e.targetGroup} の説明がありません`);
  }
  if (!e.field || !Array.isArray(e.organs) || e.organs.length === 0) fail(`${where}: field/organs が不足しています`);
  if (!Array.isArray(e.recommended) || e.recommended.length === 0) fail(`${where}: recommended が空です`);
}
for (const r of prophylaxis.betaLactamAllergy ?? []) {
  checkSource(r.source, `BetaLactamAllergy(${r.id})`);
}
for (const d of prophylaxis.doses ?? []) {
  const where = `ProphylaxisDose(${d.drug})`;
  checkSource(d.source, where);
  if (!drugIds.has(d.drugId)) fail(`${where}: drugId の参照切れ — ${d.drugId}`);
  if (!Array.isArray(d.bands) || d.bands.length === 0) fail(`${where}: bands が空です`);
  for (const [i, b] of (d.bands ?? []).entries()) {
    if (!b.text) fail(`${where}.bands[${i}]: text がありません`);
    if (b.weightMin != null && b.weightMax != null && b.weightMin >= b.weightMax) {
      fail(`${where}.bands[${i}]: 体重帯が不正です（min >= max）`);
    }
    if (b.perKg && !VALID_BASIS.has(b.perKg.basis)) {
      fail(`${where}.bands[${i}]: perKg.basis が不正です`);
    }
  }
  // 体重帯に隙間・重なりがないこと
  const sorted = [...d.bands].filter((b) => b.weightMin != null || b.weightMax != null)
    .sort((a, b) => (a.weightMin ?? -Infinity) - (b.weightMin ?? -Infinity));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].weightMax !== sorted[i].weightMin) {
      fail(`${where}: 体重帯が連続していません（${sorted[i - 1].weightMax} → ${sorted[i].weightMin}）`);
    }
  }
}
for (const key of ["timing", "duration"]) {
  if (!Array.isArray(prophylaxis[key]) || prophylaxis[key].length === 0) {
    fail(`Prophylaxis.${key}: 空です`);
  }
}

/* ---------- 参考情報 ---------- */

for (const key of [
  "anaphylaxis", "postExposureProphylaxis", "pediatricWeight",
  "pcgContinuousInfusion", "stewardship", "aware",
]) {
  const section = reference[key];
  if (!section) {
    fail(`Reference.${key}: セクションがありません`);
    continue;
  }
  checkSource(section.source, `Reference.${key}`);
  if (!section.title) fail(`Reference.${key}: title がありません`);
}

for (const e of reference.postExposureProphylaxis?.entries ?? []) {
  if (!e.disease) fail(`PostExposure(${e.id}): disease がありません`);
  if (!Array.isArray(e.regimens) || e.regimens.length === 0) {
    fail(`PostExposure(${e.id}): regimens が空です`);
  }
}
for (const r of reference.pcgContinuousInfusion?.regimens ?? []) {
  if (!Number.isInteger(r.dailyUnits) || r.dailyUnits <= 0) {
    fail(`PCG(${r.dailyLabel}): dailyUnits が不正です`);
  }
  if (!Array.isArray(r.routes) || r.routes.length === 0) {
    fail(`PCG(${r.dailyLabel}): routes が空です`);
  }
}
for (const row of reference.pediatricWeight?.table ?? []) {
  if (typeof row.weight !== "number" || row.weight <= 0 || row.weight > 100) {
    fail(`PediatricWeight(${row.age}): weight が不正です — ${row.weight}`);
  }
}

/* ---------- 大項目レーンの網羅性（UI再編 版2.1・要件 FR-011-1） ----------
 *
 * ホームの大項目は「内服薬（po）／注射薬（iv・im・inhalation）」で薬剤を分ける。
 * どちらのレーンにも現れない薬剤があると、検索窓からしか到達できない薬剤が生まれる。
 */

const INJECTABLE_ROUTES = ["iv", "im", "inhalation"];
const hasDose = (drug, mode, route) => (drug[mode]?.[route]?.length ?? 0) > 0;
const inOral = (drug, mode) => hasDose(drug, mode, "po");
const inInjectable = (drug, mode) => INJECTABLE_ROUTES.some((r) => hasDose(drug, mode, r));

for (const drug of drugs) {
  const reachable = ["adult", "pediatric"].some(
    (mode) => inOral(drug, mode) || inInjectable(drug, mode),
  );
  if (!reachable) {
    fail(
      `Drug(${drug.id}): 内服・注射のどちらの用量も持たないため、大項目のどちらのレーンにも現れません`,
    );
  }
}

const laneCounts = {
  "内服×成人": drugs.filter((d) => inOral(d, "adult")).length,
  "内服×小児": drugs.filter((d) => inOral(d, "pediatric")).length,
  "注射×成人": drugs.filter((d) => inInjectable(d, "adult")).length,
  "注射×小児": drugs.filter((d) => inInjectable(d, "pediatric")).length,
};
for (const [lane, n] of Object.entries(laneCounts)) {
  if (n === 0) fail(`レーン「${lane}」に該当する薬剤が1件もありません`);
}

/* ---------- 出力 ---------- */

const counts = {
  薬剤: drugs.length,
  菌: organisms.length,
  疾患: diseases.length,
  適応外使用: offlabel.length,
  アンチバイオグラム行: (antibiogram.rows ?? []).length,
  周術期エントリ: (prophylaxis.entries ?? []).length,
  曝露後予防: (reference.postExposureProphylaxis?.entries ?? []).length,
};

console.log("データ件数:", JSON.stringify(counts, null, 0));
console.log("レーン件数:", JSON.stringify(laneCounts, null, 0));

for (const w of warnings) console.warn(`  warn  ${w}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} 件のエラー:`);
  for (const e of errors) console.error(`  error ${e}`);
  process.exit(1);
}

console.log(`\nOK — エラー 0 件 / 警告 ${warnings.length} 件`);
