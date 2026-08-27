/**
 * TDM採血日時の算出（UI再編 版2.0 §3.2(4)）
 *
 * 原典の「◯ドーズ目以降でTDMを行う」という記載を、具体的な日時に翻訳するだけの計算。
 * 投与間隔とドーズ数の足し算であり、薬物動態の推定は一切行わない。
 *
 * 「何ドーズ目の投与直前に採血するか」は原典が薬剤ごとに定めている（firstTdmDose）。
 * n ドーズ目の投与時刻 = 初回投与時刻 + 投与間隔 ×(n − 1)
 * トラフはその投与の直前に採るため、算出した時刻がそのまま採血時刻になる。
 */

/** 原典の firstTdmDose 文字列から「何ドーズ目か」を読み取る。読めなければ null */
export function parseFirstTdmDose(text: string | undefined): number | null {
  if (!text) return null;
  // 「5ドーズ目以降（重症例では2-4ドーズ目を考慮）」→ 先頭の数値を採る
  const m = text.match(/(\d+)\s*ドーズ目/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export type SamplingSchedule = {
  /** 何ドーズ目の投与直前か */
  doseNumber: number;
  /** その投与（＝採血）の日時 */
  at: Date;
  /** 初回投与から何時間後か */
  hoursAfterFirst: number;
};

/**
 * n ドーズ目の投与直前の日時を求める。
 *
 * 入力が1つでも欠けたら null を返し、推定で埋めない
 * （欠測時に既定値を出さないという §3.2(1) の方針と揃える）。
 */
export function samplingSchedule(
  firstDoseAt: Date | null,
  intervalHours: number | null,
  doseNumber: number | null,
): SamplingSchedule | null {
  if (firstDoseAt == null || Number.isNaN(firstDoseAt.getTime())) return null;
  if (intervalHours == null || !Number.isFinite(intervalHours) || intervalHours <= 0) return null;
  if (doseNumber == null || !Number.isFinite(doseNumber) || doseNumber < 1) return null;

  const hoursAfterFirst = intervalHours * (doseNumber - 1);
  const at = new Date(firstDoseAt.getTime() + hoursAfterFirst * 3600_000);
  return { doseNumber, at, hoursAfterFirst };
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 「8月30日(土) 21:00」形式。年をまたぐ場合のみ年を添える */
export function formatSamplingTime(at: Date, from: Date = new Date()): string {
  const y = at.getFullYear() !== from.getFullYear() ? `${at.getFullYear()}年` : "";
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `${y}${at.getMonth() + 1}月${at.getDate()}日(${WEEKDAYS[at.getDay()]}) ${hh}:${mm}`;
}

/** datetime-local の値（"2026-08-27T21:00"）を Date にする。空文字は null */
export function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
