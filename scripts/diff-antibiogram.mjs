#!/usr/bin/env node
/**
 * アンチバイオグラム 原データ突合ツール
 *
 * 感染制御管理室・検査部が作成した Excel を CSV で書き出し、
 * src/data/antibiogram.json と1セルずつ突き合わせる。
 *
 *   # 突合（差分を表示するだけ。ファイルは変更しない）
 *   node scripts/diff-antibiogram.mjs 入院.csv --setting inpatient
 *
 *   # 差分を antibiogram.json に反映する
 *   node scripts/diff-antibiogram.mjs 入院.csv --setting inpatient --apply
 *
 *   # 現在の JSON を CSV に書き出す（原本との目視照合用チェックシート）
 *   node scripts/diff-antibiogram.mjs --export --setting inpatient > checksheet.csv
 *
 * 期待する CSV の形（原典 p.70-71 の表をそのまま保存したもの）:
 *
 *   菌名,菌数,ABPC,PIPC,S/A,T/P,MEPM,...
 *   Escherichia coli,583,66,75,76,96,100,...
 *   Escherichia coli （ESBL）,122,,,34,93,100,...
 *
 *   - 「菌数」を含む行をヘッダとして自動検出する
 *   - 菌名は organisms.json の学名・短縮名・日本語名・別名で照合する
 *   - 空欄は「データなし」として扱う（0% ではない）
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(root, "src/data/antibiogram.json");

const antibiogram = JSON.parse(readFileSync(DATA, "utf8"));
const organisms = JSON.parse(
  readFileSync(join(root, "src/data/organisms.json"), "utf8"),
);

/* ---------- 引数 ---------- */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const csvPath = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--setting");

const setting = opt("setting");
if (!["inpatient", "outpatient"].includes(setting)) {
  console.error("--setting inpatient | outpatient を指定してください");
  process.exit(2);
}
const settingLabel = setting === "inpatient" ? "入院" : "外来";

/* ---------- 正規化 ---------- */

const normalize = (s) =>
  String(s ?? "")
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[ー・\s/\-_.,()（）[\]{}　]/g, "");

/**
 * 原典の表で使われる略記と、antibiogram.json の列名の対応。
 * 検査部の Excel が別の書き方をしている場合はここに追加する。
 */
const COLUMN_ALIASES = {
  "SBT/ABPC": ["S/A", "SBT/ABPC", "ABPC/SBT", "スルバシリン", "ユナシン"],
  "TAZ/PIPC": ["T/P", "TAZ/PIPC", "PIPC/TAZ", "タゾピペ", "ゾシン"],
  ABPC: ["ABPC", "AMPC"],
  PIPC: ["PIPC"],
  MEPM: ["MEPM"],
  CEZ: ["CEZ"],
  CMZ: ["CMZ"],
  CTRX: ["CTRX"],
  CAZ: ["CAZ"],
  CFPM: ["CFPM"],
  AMK: ["AMK"],
  CLDM: ["CLDM"],
  CPFX: ["CPFX"],
  LVFX: ["LVFX"],
  ST: ["ST", "ST合剤", "SMX/TMP", "TMP/SMX"],
  PCG: ["PCG", "PCG(ペニシリンG)", "ペニシリンG"],
  MINO: ["MINO"],
  VCM: ["VCM"],
};

const COLUMN_LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const a of aliases) COLUMN_LOOKUP.set(normalize(a), canonical);
}

/** 抗菌薬ではない列。警告を出さずに無視する */
const IGNORED_COLUMNS = new Set(
  ["注記", "備考", "コメント", "菌名", "耐性菌の割合", "割合"].map(normalize),
);

const ORGANISM_LOOKUP = new Map();
for (const o of organisms) {
  for (const key of [o.scientificName, o.shortName, o.japaneseName, ...(o.aliases ?? [])]) {
    if (!key) continue;
    const n = normalize(key);
    // 別名は複数の菌で共有されるため（例：「大腸菌」）、
    // 一意に決まるものだけを照合キーに使う
    if (ORGANISM_LOOKUP.has(n) && ORGANISM_LOOKUP.get(n) !== o.id) {
      ORGANISM_LOOKUP.set(n, null); // 曖昧
    } else {
      ORGANISM_LOOKUP.set(n, o.id);
    }
  }
}
const nameOf = (id) => organisms.find((o) => o.id === id)?.japaneseName ?? id;

const rowOf = (organismId) =>
  antibiogram.rows.find((r) => r.organismId === organismId && r.setting === setting);

/* ---------- チェックシート書き出し ---------- */

if (flag("export")) {
  const gnr = antibiogram.meta.gnrColumns;
  const gpc = antibiogram.meta.gpcColumns;
  const lines = [];
  lines.push(`# ${antibiogram.meta.facility} ${antibiogram.meta.year} アンチバイオグラム（${settingLabel}）突合用チェックシート`);
  lines.push(`# ${antibiogram.meta.period} ／ 現在のアプリ収載値。原本と1セルずつ照合してください`);
  lines.push("");

  for (const [label, columns] of [["グラム陰性桿菌・嫌気性菌", gnr], ["グラム陽性球菌", gpc]]) {
    lines.push(`## ${label}`);
    lines.push(["菌名", "菌数", ...columns, "注記"].join(","));
    for (const row of antibiogram.rows.filter((r) => r.setting === setting)) {
      const org = organisms.find((o) => o.id === row.organismId);
      const isGpc = org?.gramStain === "gram_positive_coccus";
      if ((label.includes("陽性") && !isGpc) || (!label.includes("陽性") && isGpc)) continue;
      lines.push(
        [
          `"${org?.scientificName ?? row.organismId}"`,
          row.isolates,
          ...columns.map((c) => row.susceptibility[c] ?? ""),
          `"${(row.annotations ?? []).join(" / ")}"`,
        ].join(","),
      );
    }
    lines.push("");
  }
  process.stdout.write("﻿" + lines.join("\n") + "\n"); // BOM付きでExcelが文字化けしない
  process.exit(0);
}

/* ---------- CSV 読み込み ---------- */

if (!csvPath) {
  console.error("突合する CSV のパスを指定してください（--export でチェックシート書き出し）");
  process.exit(2);
}

/** ダブルクォート対応の最小限の CSV パーサ */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const csv = parseCsv(readFileSync(csvPath, "utf8"));

/* ---------- ヘッダ検出と突合 ---------- */

const findings = [];
const add = (severity, where, detail) => findings.push({ severity, where, detail });

let header = null;
let headerColumns = null;
let matchedOrganisms = 0;
let comparedCells = 0;
let diffCells = 0;
const updates = [];
const seenInCsv = new Set();

for (const [lineNo, raw] of csv.entries()) {
  const cells = raw.map((c) => c.trim());
  if (cells.every((c) => c === "")) continue;
  if (cells[0]?.startsWith("#")) continue;

  // ヘッダ行：「菌数」を含む行
  const countIdx = cells.findIndex((c) => normalize(c) === normalize("菌数"));
  if (countIdx >= 0) {
    header = cells;
    headerColumns = cells.map((c, i) => {
      if (i <= countIdx) return null;
      const canonical = COLUMN_LOOKUP.get(normalize(c));
      if (!canonical && c !== "" && !IGNORED_COLUMNS.has(normalize(c))) {
        add("warn", `CSV ${lineNo + 1}行目`, `未知の列見出し「${c}」— 突合の対象外にしました。COLUMN_ALIASES に追加してください`);
      }
      return canonical ?? null;
    });
    continue;
  }

  if (!header) continue;

  // データ行
  const rawName = cells[0];
  if (!rawName) continue;
  const organismId = ORGANISM_LOOKUP.get(normalize(rawName));

  if (organismId === undefined) {
    add("error", `CSV ${lineNo + 1}行目`, `菌名「${rawName}」が菌マスタにありません。organisms.json に別名を追加してください`);
    continue;
  }
  if (organismId === null) {
    add("error", `CSV ${lineNo + 1}行目`, `菌名「${rawName}」が複数の菌に一致します。学名で記載してください`);
    continue;
  }

  const jsonRow = rowOf(organismId);
  if (!jsonRow) {
    add("error", nameOf(organismId), `${settingLabel}のデータがアプリ側にありません`);
    continue;
  }
  matchedOrganisms++;
  seenInCsv.add(organismId);

  const where = nameOf(organismId);

  // 菌数
  const csvIsolatesIdx = header.findIndex((c) => normalize(c) === normalize("菌数"));
  const csvIsolates = Number(cells[csvIsolatesIdx]);
  if (Number.isFinite(csvIsolates) && csvIsolates !== jsonRow.isolates) {
    diffCells++;
    add("error", where, `菌数が違います — アプリ ${jsonRow.isolates} / 原データ ${csvIsolates}`);
    updates.push({ organismId, key: "isolates", value: csvIsolates });
  }

  // 各抗菌薬
  const csvValues = {};
  for (const [i, canonical] of headerColumns.entries()) {
    if (!canonical) continue;
    const cell = cells[i] ?? "";
    if (cell === "" || cell === "-" || cell === "—") continue;
    const v = Number(cell.replace("%", ""));
    if (!Number.isFinite(v)) {
      add("error", where, `${canonical}: 数値として読めません「${cell}」`);
      continue;
    }
    csvValues[canonical] = Math.round(v);
  }

  const allColumns = new Set([...Object.keys(csvValues), ...Object.keys(jsonRow.susceptibility)]);
  for (const abx of allColumns) {
    const inJson = jsonRow.susceptibility[abx];
    const inCsv = csvValues[abx];
    comparedCells++;

    if (inJson == null && inCsv != null) {
      diffCells++;
      add("error", where, `${abx}: アプリは空欄だが原データは ${inCsv}%`);
      updates.push({ organismId, key: "susceptibility", abx, value: inCsv });
    } else if (inJson != null && inCsv == null) {
      diffCells++;
      add("error", where, `${abx}: アプリは ${inJson}% だが原データは空欄（列の取り違えの可能性）`);
      updates.push({ organismId, key: "susceptibility", abx, value: null });
    } else if (inJson !== inCsv) {
      diffCells++;
      add("error", where, `${abx}: アプリ ${inJson}% / 原データ ${inCsv}%`);
      updates.push({ organismId, key: "susceptibility", abx, value: inCsv });
    }
  }
}

// CSV に出てこなかった菌
for (const row of antibiogram.rows.filter((r) => r.setting === setting)) {
  if (!seenInCsv.has(row.organismId)) {
    add("warn", nameOf(row.organismId), `原データ CSV に該当行が見つかりませんでした（未突合）`);
  }
}

/* ---------- 反映 ---------- */

if (flag("apply") && updates.length > 0) {
  for (const u of updates) {
    const row = rowOf(u.organismId);
    if (u.key === "isolates") row.isolates = u.value;
    else if (u.value == null) delete row.susceptibility[u.abx];
    else row.susceptibility[u.abx] = u.value;
  }
  writeFileSync(DATA, JSON.stringify(antibiogram, null, 2) + "\n", "utf8");
  console.log(`\n${updates.length} 件を antibiogram.json に反映しました。`);
  console.log(
    "全ての菌・区分の突合が完了したら、antibiogram.json の meta.verified を true にし、" +
      "\nmeta.verificationNote に突合日・実施者を記載してください（アプリの検証待ちバナーが消えます）。",
  );
}

/* ---------- 出力 ---------- */

const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

console.log(
  `アンチバイオグラム突合（${settingLabel}）\n` +
    `  照合できた菌: ${matchedOrganisms} ／ 比較したセル: ${comparedCells} ／ 相違: ${diffCells}\n`,
);

for (const f of warns) console.warn(`  warn  [${f.where}] ${f.detail}`);
if (warns.length > 0) console.log("");

if (errors.length > 0) {
  console.error(`${errors.length} 件の相違:`);
  for (const f of errors) console.error(`  差分  [${f.where}] ${f.detail}`);
  if (!flag("apply")) {
    console.error("\n--apply を付けて再実行すると antibiogram.json に反映します。");
  }
  process.exit(1);
}

console.log(`相違なし — アプリの収載値は原データと一致しています。`);
