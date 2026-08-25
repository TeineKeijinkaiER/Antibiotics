/**
 * 日本語の表記ゆれを吸収する正規化。
 * 要件 FR-002-2 / FR-007-1（大文字小文字・全角半角・ひらがなカタカナ・長音・記号）
 */

/** 全角英数記号 → 半角 */
function toHalfWidth(s: string): string {
  return s.replace(/[！-～]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/** ひらがな → カタカナ */
function hiraToKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0x60),
  );
}

/** 半角カナ → 全角カナ（濁点・半濁点の合成を含む） */
const HANKAKU_KANA_MAP: Record<string, string> = {
  "ｶﾞ": "ガ", "ｷﾞ": "ギ", "ｸﾞ": "グ", "ｹﾞ": "ゲ", "ｺﾞ": "ゴ",
  "ｻﾞ": "ザ", "ｼﾞ": "ジ", "ｽﾞ": "ズ", "ｾﾞ": "ゼ", "ｿﾞ": "ゾ",
  "ﾀﾞ": "ダ", "ﾁﾞ": "ヂ", "ﾂﾞ": "ヅ", "ﾃﾞ": "デ", "ﾄﾞ": "ド",
  "ﾊﾞ": "バ", "ﾋﾞ": "ビ", "ﾌﾞ": "ブ", "ﾍﾞ": "ベ", "ﾎﾞ": "ボ",
  "ﾊﾟ": "パ", "ﾋﾟ": "ピ", "ﾌﾟ": "プ", "ﾍﾟ": "ペ", "ﾎﾟ": "ポ",
  "ｳﾞ": "ヴ",
  "ｱ": "ア", "ｲ": "イ", "ｳ": "ウ", "ｴ": "エ", "ｵ": "オ",
  "ｶ": "カ", "ｷ": "キ", "ｸ": "ク", "ｹ": "ケ", "ｺ": "コ",
  "ｻ": "サ", "ｼ": "シ", "ｽ": "ス", "ｾ": "セ", "ｿ": "ソ",
  "ﾀ": "タ", "ﾁ": "チ", "ﾂ": "ツ", "ﾃ": "テ", "ﾄ": "ト",
  "ﾅ": "ナ", "ﾆ": "ニ", "ﾇ": "ヌ", "ﾈ": "ネ", "ﾉ": "ノ",
  "ﾊ": "ハ", "ﾋ": "ヒ", "ﾌ": "フ", "ﾍ": "ヘ", "ﾎ": "ホ",
  "ﾏ": "マ", "ﾐ": "ミ", "ﾑ": "ム", "ﾒ": "メ", "ﾓ": "モ",
  "ﾔ": "ヤ", "ﾕ": "ユ", "ﾖ": "ヨ",
  "ﾗ": "ラ", "ﾘ": "リ", "ﾙ": "ル", "ﾚ": "レ", "ﾛ": "ロ",
  "ﾜ": "ワ", "ｦ": "ヲ", "ﾝ": "ン",
  "ｧ": "ァ", "ｨ": "ィ", "ｩ": "ゥ", "ｪ": "ェ", "ｫ": "ォ",
  "ｬ": "ャ", "ｭ": "ュ", "ｮ": "ョ", "ｯ": "ッ", "ｰ": "ー",
};

function hankakuKanaToZenkaku(s: string): string {
  return s.replace(/[｡-ﾟ]ﾞ?ﾟ?|[｡-ﾟ]/g, (c) => HANKAKU_KANA_MAP[c] ?? c);
}

/**
 * 検索用のキー文字列に変換する。
 * 長音・中黒・空白・スラッシュ等の区切り文字は落とし、`セフトリアキソン` と
 * `セフト リアキソン`、`TAZ/PIPC` と `TAZPIPC` を同一視する。
 */
export function normalize(input: string): string {
  let s = input;
  s = hankakuKanaToZenkaku(s);
  s = toHalfWidth(s);
  s = s.toLowerCase();
  s = hiraToKata(s);
  s = s.replace(/[ー・\s/\-_.,()（）[\]{}]/g, "");
  return s;
}

/** 前方一致 > 部分一致 > 不一致 のスコア。0 は不一致 */
export function matchScore(haystack: string, needle: string): number {
  if (!needle) return 0;
  const idx = haystack.indexOf(needle);
  if (idx < 0) return 0;
  if (idx === 0) return haystack.length === needle.length ? 100 : 80;
  return 50;
}
