#!/usr/bin/env node
/**
 * 軸2：データの数値記載が、引用している原典ページに実在するかを全件照合する。
 *
 * 出力は「検出」であって「誤り」ではない。原典側の書き方（数値と単位の間に
 * 語が挟まる、割合を漢数字で書くなど）で普通に偽陽性が出る。必ず1件ずつ原典を開く。
 *
 * 使い方:
 *   node check-source-fidelity.mjs --pages out/manual.txt --data src/data/drugs.json \
 *        --config skills/medical-content-review/scripts/fields.example.json
 *
 * config は「データのどこを、どのページ番号と照合するか」を宣言する:
 *   {
 *     "pagesField": "source.pages",     // 各レコードの引用ページ配列への path
 *     "labelField": "genericName.ja",   // 報告に出す名前への path
 *     "textFields": ["adult.*.*.text", "renal.*"]   // 照合したい文字列への path（* は全要素）
 *   }
 */

import { readFileSync } from "node:fs";

/* ---------------- 引数 ---------------- */

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`--${name} が必要です`);
};

const pagesPath = arg("pages");
const dataPaths = arg("data").split(",");
const config = JSON.parse(readFileSync(arg("config"), "utf8"));

/* ---------------- 正規化 ---------------- */

/**
 * 全角/半角、空白、各種ダッシュを畳んで比較可能にする。
 * 原典PDFは同じ数値を「20〜40」「20～40」「20-40」と書き分けるので、
 * ここを揃えないと大量の偽陽性が出る。
 */
const norm = (s) =>
  String(s)
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[−–—ー―~〜]/g, "-")
    .toLowerCase();

/* ---------------- 原典ページの読み込み ---------------- */

function loadPages(file) {
  const raw = readFileSync(file, "utf8");
  // 正規表現リテラルで書く。文字列から RegExp を組むとエスケープが落ちて黙って壊れる
  const parts = raw.split(/===== \[[A-Za-z0-9_]+ p\.(\d+)\] =====/).slice(1);
  if (parts.length === 0) {
    throw new Error(
      `${file} からページ区切りを検出できませんでした。extract_pdf_text.py で作ったファイルか確認してください`,
    );
  }
  const m = new Map();
  for (let i = 0; i < parts.length; i += 2) m.set(Number(parts[i]), norm(parts[i + 1] ?? ""));
  return m;
}

const PAGES = loadPages(pagesPath);

/* ---------------- path 解決 ---------------- */

/** "a.b.c" / "a.*.b" を辿って値の配列を返す */
function resolve(obj, path) {
  let nodes = [obj];
  for (const key of path.split(".")) {
    const next = [];
    for (const n of nodes) {
      if (n == null) continue;
      if (key === "*") {
        if (Array.isArray(n)) next.push(...n);
        else if (typeof n === "object") next.push(...Object.values(n));
      } else if (typeof n === "object") {
        next.push(n[key]);
      }
    }
    nodes = next;
  }
  return nodes.filter((v) => v != null);
}

const first = (obj, path) => resolve(obj, path)[0];

/* ---------------- トークン抽出 ---------------- */

/**
 * 用量文字列から照合可能な「数値＋単位」を取り出す。
 * 単位を列挙しているのは、裸の数値まで拾うと文中のページ番号や年号と
 * 偶然一致して検出漏れになるため。
 */
const UNIT = String.raw`mg/kg|万単位|mg|µg|μg|g|ml|単位|%|日間|週間|時間毎|回`;
function tokens(text) {
  const t = norm(text);
  const out = new Set();
  const re = new RegExp(String.raw`(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)(${UNIT})`, "g");
  let m;
  while ((m = re.exec(t))) out.add(m[1] + m[2]);
  return [...out];
}

/* ---------------- 照合 ---------------- */

const records = dataPaths.flatMap((p) => {
  const parsed = JSON.parse(readFileSync(p, "utf8"));
  return Array.isArray(parsed) ? parsed : [parsed];
});

const report = [];
let checked = 0;
let skipped = 0;

for (const rec of records) {
  const pages = first(rec, config.pagesField) ?? [];
  const label = first(rec, config.labelField) ?? "(名称不明)";
  const corpus = pages.map((p) => PAGES.get(p) ?? "").join("|");

  if (!pages.length || !corpus.replace(/\|/g, "")) {
    skipped += 1;
    continue;
  }

  for (const fieldPath of config.textFields) {
    for (const value of resolve(rec, fieldPath)) {
      if (typeof value !== "string") continue;
      checked += 1;
      const missing = tokens(value).filter((t) => !corpus.includes(norm(t)));
      if (missing.length) {
        report.push({ label, pages: pages.join(","), fieldPath, value, missing });
      }
    }
  }
}

/* ---------------- 出力 ---------------- */

console.log(`原典ページ: ${PAGES.size}p を読み込み`);
console.log(`レコード: ${records.length}件（引用ページなし等で照合対象外: ${skipped}件）`);
console.log(`照合した文字列: ${checked}件`);

if (checked === 0) {
  console.error(
    "\n照合が0件でした。config の textFields / pagesField の path がデータ構造と合っているか確認してください。",
  );
  process.exit(2);
}

console.log(`\n引用ページに見当たらない数値を含む記載: ${report.length}件\n`);
for (const r of report) {
  console.log(`[${r.label}] p.${r.pages}  ${r.fieldPath}`);
  console.log(`   記載  : ${r.value.replace(/\n/g, " ")}`);
  console.log(`   未検出: ${r.missing.join(" / ")}\n`);
}
console.log(
  report.length
    ? "※ 原典側の表記（『20〜40 mg（力価）/kg』『3%〜10%』『約9割』等）で偽陽性が出ます。1件ずつ原典を開いて確認してください。"
    : "※ 0件は「原典の数値を正しく写している」までを意味します。原典自体の妥当性は軸3で見ます。",
);
