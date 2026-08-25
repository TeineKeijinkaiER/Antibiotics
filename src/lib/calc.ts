import type { PatientState, PerKgDose, RenalBand, Drug } from "../types";

/**
 * Cockcroft-Gault 式による CCr（原典 p.16）
 * 男性: CCr = {(140-年齢)×体重} / {72×Cr}
 * 女性: CCr = 0.85 × 上式
 */
export function cockcroftGault(p: PatientState): number | null {
  const { age, sex, weight, scr } = p;
  if (age == null || sex == null || weight == null || scr == null) return null;
  if (scr <= 0 || weight <= 0 || age < 0) return null;
  const base = ((140 - age) * weight) / (72 * scr);
  return sex === "female" ? base * 0.85 : base;
}

/** 理想体重 IBW(kg) = 身長(m)^2 × 22（原典 p.34） */
export function idealBodyWeight(heightCm: number | null): number | null {
  if (heightCm == null || heightCm <= 0) return null;
  const m = heightCm / 100;
  return m * m * 22;
}

/** 補正体重 AdjBW = IBW + 0.4 × (実測体重 - IBW)（原典 p.34） */
export function adjustedBodyWeight(
  weight: number | null,
  heightCm: number | null,
): number | null {
  const ibw = idealBodyWeight(heightCm);
  if (ibw == null || weight == null) return null;
  return ibw + 0.4 * (weight - ibw);
}

/**
 * 実体重が理想体重から20%以上乖離しているか。
 * アミノグリコシドで補正体重を用いる判定に使う（原典 p.34）
 */
export function isObeseByIbw(
  weight: number | null,
  heightCm: number | null,
): boolean | null {
  const ibw = idealBodyWeight(heightCm);
  if (ibw == null || weight == null || ibw <= 0) return null;
  return (weight - ibw) / ibw >= 0.2;
}

/**
 * 患者条件から該当する腎機能区分を決定する。
 * 腎代替療法が設定されていれば CCr 区分より優先する（要件 FR-004-2）。
 */
export function resolveRenalBand(p: PatientState): RenalBand | null {
  if (p.rrt === "hd") return "hd";
  if (p.rrt === "chdf") return "chdf";
  const ccr = cockcroftGault(p);
  if (ccr == null) return null;
  if (ccr > 50) return "gt50";
  if (ccr >= 10) return "ccr10_50";
  return "lt10";
}

/** 体重基準に応じて換算に使う体重を返す */
export function weightForBasis(
  p: PatientState,
  basis: PerKgDose["basis"],
): { value: number; label: string } | null {
  if (basis === "actual") {
    return p.weight != null ? { value: p.weight, label: "実体重" } : null;
  }
  if (basis === "ideal") {
    const ibw = idealBodyWeight(p.height);
    return ibw != null ? { value: ibw, label: "理想体重" } : null;
  }
  const adj = adjustedBodyWeight(p.weight, p.height);
  return adj != null ? { value: adj, label: "補正体重" } : null;
}

function roundDose(v: number): number {
  if (v >= 100) return Math.round(v);
  if (v >= 10) return Math.round(v * 10) / 10;
  return Math.round(v * 100) / 100;
}

/**
 * mg/kg 用量を絶対量に換算する（要件 FR-003-5）。
 * 上限が定義されていればクリップし、クリップした事実を返す。
 */
export function convertPerKg(
  dose: PerKgDose,
  p: PatientState,
): { text: string; clipped: boolean; basisLabel: string } | null {
  const w = weightForBasis(p, dose.basis);
  if (w == null) return null;

  const amounts = Array.isArray(dose.amount) ? dose.amount : [dose.amount];
  let clipped = false;
  const limit = dose.per === "perDose" ? dose.maxPerDose : dose.maxPerDay;

  const values = amounts.map((a) => {
    let v = a * w.value;
    if (limit != null && v > limit) {
      v = limit;
      clipped = true;
    }
    return roundDose(v);
  });

  const joined = values.length > 1 ? `${values[0]}-${values[1]}` : `${values[0]}`;
  const perLabel = dose.per === "perDose" ? "1回" : "1日";
  return {
    text: `${perLabel} ${joined}${dose.unit}`,
    clipped,
    basisLabel: `${w.label} ${roundDose(w.value)}kg`,
  };
}

/**
 * 薬剤・腎機能区分から表示すべき腎機能用量を返す。
 * 原典に該当区分の記載がない場合は null を返し、呼び出し側が
 * 「原典に記載なし」と表示する（要件 FR-004-4：勝手に補完しない）。
 */
export function renalDoseFor(
  drug: Drug,
  band: RenalBand | null,
  route: "iv" | "po",
): string | null {
  if (band == null) return null;
  const table = route === "po" ? drug.renalPo : drug.renal;
  return table?.[band] ?? null;
}

/** 入力値の妥当性（要件 FR-001-6） */
export const INPUT_RANGE = {
  age: { min: 0, max: 120, unit: "歳" },
  weight: { min: 0.4, max: 300, unit: "kg" },
  height: { min: 30, max: 250, unit: "cm" },
  scr: { min: 0.1, max: 20, unit: "mg/dL" },
  egfr: { min: 1, max: 200, unit: "mL/min/1.73m²" },
} as const;

export function outOfRange(
  key: keyof typeof INPUT_RANGE,
  value: number | null,
): boolean {
  if (value == null) return false;
  const r = INPUT_RANGE[key];
  return value < r.min || value > r.max;
}
