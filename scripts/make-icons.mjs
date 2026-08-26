#!/usr/bin/env node
/**
 * PWA用アイコン（PNG）を生成する。
 *
 * 依存パッケージを増やさないため、Node標準の zlib だけで PNG を書き出す。
 * 図案はファビコンと同じ「錠剤（カプセル）」のマーク。
 *
 *   node scripts/make-icons.mjs
 *   → public/icon-192.png / public/icon-512.png / public/icon-maskable-512.png
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });

const TEAL = [14, 107, 99]; // --accent #0e6b63
const WHITE = [255, 255, 255];

/* ---------- PNG エンコーダ ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array(size*size*4) → PNG Buffer */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // 10,11,12 = compression / filter / interlace = 0

  // 各行の先頭にフィルタタイプ 0 を置く
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy
      ? rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
      : Buffer.from(rgba.subarray(y * size * 4, (y + 1) * size * 4)).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- 図案 ---------- */

/** 点(px,py) と線分(ax,ay)-(bx,by) の距離 */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** 角丸正方形の符号付き距離（内側が負） */
function roundedRectSdf(px, py, size, radius) {
  const half = size / 2;
  const qx = Math.abs(px - half) - (half - radius);
  const qy = Math.abs(py - half) - (half - radius);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  );
}

/**
 * アイコンを描く。
 * maskable=true のときは安全領域（中央80%）に収まるようマークを小さくし、
 * 背景を隅まで塗る。
 */
function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size;
  const cornerRadius = maskable ? 0 : s * 0.22;

  // 錠剤の軸（左下→右上の斜め）
  const scale = maskable ? 0.30 : 0.34;
  const a = { x: s * (0.5 - scale * 0.62), y: s * (0.5 + scale * 0.62) };
  const b = { x: s * (0.5 + scale * 0.62), y: s * (0.5 - scale * 0.62) };
  const outerR = s * scale * 0.46;
  const strokeW = s * scale * 0.17;

  // 錠剤を割る線（軸の中央を横切る）
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const perp = { x: (b.y - a.y), y: -(b.x - a.x) };
  const plen = Math.hypot(perp.x, perp.y);
  const px1 = midX - (perp.x / plen) * outerR;
  const py1 = midY - (perp.y / plen) * outerR;
  const px2 = midX + (perp.x / plen) * outerR;
  const py2 = midY + (perp.y / plen) * outerR;

  const AA = 1.0; // アンチエイリアスの幅（px）

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const i = (y * s + x) * 4;

      // 背景（角丸正方形）
      const bg = maskable ? -1 : roundedRectSdf(cx, cy, s, cornerRadius);
      const bgA = Math.max(0, Math.min(1, 0.5 - bg / AA));
      if (bgA <= 0) continue;

      let r = TEAL[0], g = TEAL[1], bl = TEAL[2];

      // 錠剤の輪郭（カプセル形の縁取り）
      const dCapsule = Math.abs(distToSegment(cx, cy, a.x, a.y, b.x, b.y) - outerR) - strokeW / 2;
      // 割線
      const dSplit =
        Math.max(
          distToSegment(cx, cy, px1, py1, px2, py2) - strokeW / 2,
          distToSegment(cx, cy, a.x, a.y, b.x, b.y) - outerR + strokeW / 2,
        );

      const markA = Math.max(
        Math.max(0, Math.min(1, 0.5 - dCapsule / AA)),
        Math.max(0, Math.min(1, 0.5 - dSplit / AA)),
      );

      if (markA > 0) {
        r = Math.round(r + (WHITE[0] - r) * markA);
        g = Math.round(g + (WHITE[1] - g) * markA);
        bl = Math.round(bl + (WHITE[2] - bl) * markA);
      }

      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = bl;
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return rgba;
}

const targets = [
  { file: "icon-192.png", size: 192, opts: {} },
  { file: "icon-512.png", size: 512, opts: {} },
  { file: "icon-maskable-512.png", size: 512, opts: { maskable: true } },
  { file: "apple-touch-icon.png", size: 180, opts: {} },
];

for (const t of targets) {
  const png = encodePng(t.size, drawIcon(t.size, t.opts));
  writeFileSync(join(outDir, t.file), png);
  console.log(`${t.file}  ${t.size}×${t.size}  ${(png.length / 1024).toFixed(1)}KB`);
}
