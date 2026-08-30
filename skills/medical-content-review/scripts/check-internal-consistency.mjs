#!/usr/bin/env node
/**
 * 軸3-a：原典の内部不整合を洗う。
 *
 * 原典は同じ項目を複数箇所に書く（巻頭の一覧表と各論の詳細章、成人編と小児編、
 * 通常用量表と腎機能別表と透析表）。そこで数値が食い違っていると、実装者は
 * どちらかを無自覚に選ぶことになり、原典との差分チェックでは決して捕まらない。
 * このスクリプトはその食い違いを見つけるためにある。
 *
 * 使い方:
 *   node check-internal-consistency.mjs --pages out/manual.txt --terms terms.json
 *
 * terms.json は「同じ項目を指す語」と「拾いたい数値の種類」を宣言する:
 *   {
 *     "context": ["トラフ", "Trough", "目標血中濃度"],
 *     "terms": [
 *       { "label": "テイコプラニン", "aliases": ["テイコプラニン", "Teicoplanin", "TEIC"] }
 *     ]
 *   }
 *
 * context を指定すると、その語が近くにあるときだけ数値を拾う。
 * 指定しないと無関係な数値（ページ番号、参考文献番号）を拾って読めなくなる。
 */

import { readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0 || !argv[i + 1]) throw new Error(`--${name} が必要です`);
  return argv[i + 1];
};

const norm = (s) =>
  String(s)
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(/[−–—ー―~〜]/g, "-")
    .toLowerCase();

function loadPages(file) {
  const raw = readFileSync(file, "utf8");
  const parts = raw.split(/===== \[[A-Za-z0-9_]+ p\.(\d+)\] =====/).slice(1);
  if (parts.length === 0) throw new Error(`${file} からページ区切りを検出できませんでした`);
  const m = new Map();
  // 原文（表示用）と正規化版（検索用）の両方を持つ
  for (let i = 0; i < parts.length; i += 2) {
    m.set(Number(parts[i]), { raw: parts[i + 1] ?? "", norm: norm(parts[i + 1] ?? "") });
  }
  return m;
}

const PAGES = loadPages(arg("pages"));
const spec = JSON.parse(readFileSync(arg("terms"), "utf8"));
const context = (spec.context ?? []).map(norm);

/** 数値レンジ・不等号つき数値を単位ごと拾う */
const UNIT = String.raw`mg/kg|万単位|mg|µg|μg|g|ml|単位|%|日間|週間|時間毎|回`;
function values(text) {
  const out = new Set();
  const re = new RegExp(String.raw`(<|>|≦|≧)?\s*(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)(${UNIT})`, "g");
  let m;
  while ((m = re.exec(text))) out.add(`${m[1] ?? ""}${m[2]}${m[3]}`);
  return out;
}

/** 該当語の周辺だけを切り出す。ページ全体から拾うと表の別行を巻き込む */
const WINDOW = Number(process.env.CONSISTENCY_WINDOW ?? 400);
function windowsAround(pageNorm, alias) {
  const spans = [];
  let from = 0;
  for (;;) {
    const i = pageNorm.indexOf(alias, from);
    if (i < 0) break;
    spans.push(pageNorm.slice(Math.max(0, i - 80), i + WINDOW));
    from = i + alias.length;
  }
  return spans;
}

console.log(`原典ページ: ${PAGES.size}p を読み込み`);
console.log(`対象項目: ${spec.terms.length}件 / 文脈語: ${context.length ? context.join("・") : "(指定なし)"}\n`);

let flagged = 0;

for (const term of spec.terms) {
  const aliases = (term.aliases ?? [term.label]).map(norm);
  /** 値 -> それが出たページ番号の集合 */
  const byValue = new Map();

  for (const [pageNo, page] of PAGES) {
    for (const alias of aliases) {
      for (const span of windowsAround(page.norm, alias)) {
        if (context.length && !context.some((c) => span.includes(c))) continue;
        for (const v of values(span)) {
          if (!byValue.has(v)) byValue.set(v, new Set());
          byValue.get(v).add(pageNo);
        }
      }
    }
  }

  if (byValue.size === 0) continue;

  // 同じ単位で複数の異なる値が、別々のページに出ていれば不整合の候補
  const byUnit = new Map();
  for (const [v, pages] of byValue) {
    const unit = v.replace(/^[<>≦≧]?[\d.\-]+/, "");
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit).push({ v, pages: [...pages].sort((a, b) => a - b) });
  }

  const suspicious = [...byUnit.entries()].filter(([, list]) => {
    if (list.length < 2) return false;
    // 全部が同じ1ページに載っているだけなら、単に表の複数行を拾っただけ
    const allPages = new Set(list.flatMap((x) => x.pages));
    return allPages.size >= 2;
  });

  if (suspicious.length === 0) continue;

  flagged += 1;
  console.log(`## ${term.label}`);
  for (const [unit, list] of suspicious) {
    console.log(`   単位 ${unit}:`);
    for (const { v, pages } of list.sort((a, b) => a.v.localeCompare(b.v))) {
      console.log(`      ${v.padEnd(16)} p.${pages.join(", ")}`);
    }
  }
  console.log();
}

console.log(`不整合の候補が出た項目: ${flagged}件`);
console.log(
  flagged
    ? "※ 同じ項目の話かどうかは機械では判定できません。各ページを開き、本当に同じ用量・同じ目標値を指しているかを確認してください。\n" +
        "※ 確定したら、(1) どちらが正しいか (2) 実装がどちらを採用しているか (3) 過小投与か過量か をセットで記録します。"
    : "※ 0件でも、文脈語の指定が狭すぎる可能性があります。既知の不整合を1件仕込んで検出できるか試してください。",
);
