#!/usr/bin/env node
/**
 * 目視照合で見つかった訂正を antibiogram.json に反映する
 *
 * チェックシートの「訂正」欄に手書きした内容を、次の形式のテキストファイルに
 * 書き写して読み込ませる。手で書ける最小限の形にしてある。
 *
 *   # 行頭 # はコメント。空行は無視
 *   # 区分  菌名            項目        正しい値
 *   入院    Pseudomonas aeruginosa   MEPM    85
 *   入院    緑膿菌                    CAZ     -        ← - または空欄で「データなし」にする
 *   外来    E. faecium               菌数     28
 *
 *   - 区切りはタブでもカンマでも連続スペースでもよい
 *   - 区分は「入院 / 外来」または inpatient / outpatient
 *   - 菌名は学名・日本語名・略号のいずれでもよい
 *   - 項目は抗菌薬の略号、または「菌数」
 *
 * 使い方:
 *   node scripts/apply-corrections.mjs corrections.txt          # 確認のみ（変更しない）
 *   node scripts/apply-corrections.mjs corrections.txt --apply  # 反映する
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(root, "src/data/antibiogram.json");
const antibiogram = JSON.parse(readFileSync(DATA, "utf8"));
const organisms = JSON.parse(readFileSync(join(root, "src/data/organisms.json"), "utf8"));

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const file = argv.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("訂正ファイルのパスを指定してください");
  process.exit(2);
}

const normalize = (s) =>
  String(s ?? "")
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[ー・\s/\-_.,()（）[\]{}　]/g, "");

/* ---------- 菌名・列名の照合表 ---------- */

const ORGANISM_LOOKUP = new Map();
for (const o of organisms) {
  for (const key of [o.scientificName, o.shortName, o.japaneseName, ...(o.aliases ?? [])]) {
    if (!key) continue;
    const n = normalize(key);
    if (ORGANISM_LOOKUP.has(n) && ORGANISM_LOOKUP.get(n) !== o.id) ORGANISM_LOOKUP.set(n, null);
    else ORGANISM_LOOKUP.set(n, o.id);
  }
}
const nameOf = (id) => organisms.find((o) => o.id === id)?.japaneseName ?? id;

const COLUMN_ALIASES = {
  "SBT/ABPC": ["S/A", "SBT/ABPC", "ABPC/SBT"],
  "TAZ/PIPC": ["T/P", "TAZ/PIPC", "PIPC/TAZ"],
  ST: ["ST", "ST合剤", "SMX/TMP", "TMP/SMX"],
  PCG: ["PCG", "ペニシリンG"],
};
const COLUMN_LOOKUP = new Map();
for (const c of [...antibiogram.meta.gnrColumns, ...antibiogram.meta.gpcColumns]) {
  COLUMN_LOOKUP.set(normalize(c), c);
}
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const a of aliases) COLUMN_LOOKUP.set(normalize(a), canonical);
}

const SETTING_LOOKUP = new Map([
  ["入院", "inpatient"], ["inpatient", "inpatient"],
  ["外来", "outpatient"], ["outpatient", "outpatient"],
]);

/* ---------- 読み込み ---------- */

const lines = readFileSync(file, "utf8").split(/\r?\n/);
const planned = [];
const errors = [];

for (const [i, raw] of lines.entries()) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;

  const parts = line.split(/\t|,|\s{2,}/).map((s) => s.trim()).filter((s) => s !== "");
  const at = `${file}:${i + 1}`;

  if (parts.length < 3) {
    errors.push(`${at}: 「区分 菌名 項目 正しい値」の4項目が必要です — 「${line}」`);
    continue;
  }

  // 値が空欄（データなし）の場合は3項目になりうる
  const [rawSetting, rawName, rawKey, rawValue = "-"] = parts;

  const setting = SETTING_LOOKUP.get(normalize(rawSetting)) ?? SETTING_LOOKUP.get(rawSetting);
  if (!setting) {
    errors.push(`${at}: 区分が「入院 / 外来」ではありません — 「${rawSetting}」`);
    continue;
  }

  const organismId = ORGANISM_LOOKUP.get(normalize(rawName));
  if (organismId === undefined) {
    errors.push(`${at}: 菌名「${rawName}」が菌マスタにありません`);
    continue;
  }
  if (organismId === null) {
    errors.push(`${at}: 菌名「${rawName}」が複数の菌に一致します。学名で書いてください`);
    continue;
  }

  const row = antibiogram.rows.find((r) => r.organismId === organismId && r.setting === setting);
  if (!row) {
    errors.push(`${at}: ${nameOf(organismId)} の${rawSetting}データがありません`);
    continue;
  }

  const isIsolates = normalize(rawKey) === normalize("菌数");
  const column = isIsolates ? null : COLUMN_LOOKUP.get(normalize(rawKey));
  if (!isIsolates && !column) {
    errors.push(`${at}: 項目「${rawKey}」が抗菌薬の略号でも「菌数」でもありません`);
    continue;
  }

  const blank = ["-", "—", "なし", "空欄", ""].includes(rawValue);
  let value = null;
  if (!blank) {
    value = Number(String(rawValue).replace("%", ""));
    if (!Number.isFinite(value)) {
      errors.push(`${at}: 値「${rawValue}」を数値として読めません`);
      continue;
    }
    value = Math.round(value);
    if (isIsolates) {
      if (value < 0) { errors.push(`${at}: 菌数が負です`); continue; }
    } else if (value < 0 || value > 100) {
      errors.push(`${at}: 感性率が 0-100 の範囲外です — ${value}`);
      continue;
    }
  }
  if (isIsolates && blank) {
    errors.push(`${at}: 菌数は空欄にできません`);
    continue;
  }

  const before = isIsolates ? row.isolates : row.susceptibility[column];
  const after = blank ? null : value;

  planned.push({
    at,
    row,
    label: `${setting === "inpatient" ? "入院" : "外来"} ${nameOf(organismId)}`,
    key: isIsolates ? "菌数" : column,
    isIsolates,
    column,
    before: before ?? null,
    after,
  });
}

/* ---------- 出力 ---------- */

console.log(`訂正ファイル: ${file}\n`);

if (errors.length > 0) {
  console.error(`${errors.length} 件の読み取りエラー:`);
  for (const e of errors) console.error(`  error ${e}`);
  console.error("");
}

if (planned.length === 0) {
  console.log("反映できる訂正がありません。");
  process.exit(errors.length > 0 ? 1 : 0);
}

console.log(`${planned.length} 件の訂正:`);
let noop = 0;
for (const p of planned) {
  const same = p.before === p.after;
  if (same) noop++;
  console.log(
    `  ${same ? "変化なし" : "訂正　　"} [${p.label}] ${p.key}: ` +
      `${p.before == null ? "空欄" : p.before} → ${p.after == null ? "空欄" : p.after}`,
  );
}
if (noop > 0) console.log(`\n  うち ${noop} 件は現在値と同じです（転記ミスの可能性を確認してください）`);

if (!APPLY) {
  console.log("\n--apply を付けて再実行すると antibiogram.json に反映します。");
  process.exit(errors.length > 0 ? 1 : 0);
}

for (const p of planned) {
  if (p.isIsolates) {
    p.row.isolates = p.after;
  } else if (p.after == null) {
    delete p.row.susceptibility[p.column];
  } else {
    p.row.susceptibility[p.column] = p.after;
  }
}
writeFileSync(DATA, JSON.stringify(antibiogram, null, 2) + "\n", "utf8");

console.log(`\n反映しました → src/data/antibiogram.json`);
console.log("次に必ず実行してください:");
console.log("  npm run validate                     # 値域・参照切れ・加重平均の再検査");
console.log("  node scripts/make-checksheet.mjs      # 訂正後のシートを出し直して再照合");
console.log(
  "\n全ての菌・区分の照合が終わったら antibiogram.json の meta.verified を true にし、" +
    "\nmeta.verificationNote に照合日・照合者・確認者を記載してください。",
);

if (errors.length > 0) process.exit(1);
