import type { PatientState, PerKgDose, RenalBand, Drug, RenalDoseRule } from "../types";

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
): {
  text: string;
  clipped: boolean;
  basisLabel: string;
  /** 1日量を分割回数(divisionsPerDay)で割った1回あたりの表記。原典に分割回数の記載がある場合のみ */
  perDose?: { text: string; clipped: boolean };
  /** 自動適用できない上限（分割回数が不明な「1回◯mgまで」等）。表示して判断を委ねる */
  uncappedNote?: string;
} | null {
  const w = weightForBasis(p, dose.basis);
  if (w == null) return null;

  const amounts = Array.isArray(dose.amount) ? dose.amount : [dose.amount];
  let clipped = false;

  // 体重あたりの上限は換算前の mg/kg に、絶対量の上限は換算後の mg に効かせる。
  // 両者を取り違えると桁違いの用量になるため、キーで厳密に分ける。
  // 1日量に対する maxPerDose は「1回あたり」の上限であり、1日総量には適用しない
  // （分割してから divisionsPerDay の分岐でクリップする）。
  const perKgLimit =
    dose.per === "perDose" ? dose.maxPerKgPerDose : dose.maxPerKgPerDay;
  const dayAbsLimit = dose.per === "perDay" ? dose.maxPerDay : undefined;
  const doseAbsLimit = dose.per === "perDose" ? dose.maxPerDose : undefined;

  const values = amounts.map((a) => {
    let perKg = a;
    if (perKgLimit != null && perKg > perKgLimit) {
      perKg = perKgLimit;
      clipped = true;
    }
    let v = perKg * w.value;
    if (dayAbsLimit != null && v > dayAbsLimit) {
      v = dayAbsLimit;
      clipped = true;
    }
    if (doseAbsLimit != null && v > doseAbsLimit) {
      v = doseAbsLimit;
      clipped = true;
    }
    return roundDose(v);
  });

  // 原典に「分◯」の記載があれば、1日量を割って1回あたりを求め、
  // 1回あたりの上限（maxPerDose / maxPerKgPerDose）をそちらに適用する。
  let perDose: { text: string; clipped: boolean } | undefined;
  let uncappedNote: string | undefined;

  if (dose.per === "perDay" && dose.divisionsPerDay) {
    let perDoseClipped = false;
    const perDoseValues = values.map((v) => {
      let d = v / dose.divisionsPerDay!;
      // 体重あたりの1回上限（例:「1回20mg/kgまで」）。換算前の mg/kg に戻して比較する
      if (dose.maxPerKgPerDose != null) {
        const perKgPerDose = d / w.value;
        if (perKgPerDose > dose.maxPerKgPerDose) {
          d = dose.maxPerKgPerDose * w.value;
          perDoseClipped = true;
        }
      }
      if (dose.maxPerDose != null && d > dose.maxPerDose) {
        d = dose.maxPerDose;
        perDoseClipped = true;
      }
      return roundDose(d);
    });
    const perDoseJoined =
      perDoseValues.length > 1 ? `${perDoseValues[0]}-${perDoseValues[1]}` : `${perDoseValues[0]}`;
    perDose = {
      text: `1回 ${perDoseJoined}${dose.unit} を1日${dose.divisionsPerDay}回`,
      clipped: perDoseClipped,
    };
    if (perDoseClipped) {
      clipped = true;
      // 1回量が上限で頭打ちになる場合、実際に投与できる1日総量もそれに応じて下がる。
      // 見出しの「1日◯mg」がその上限より大きい値のままだと、実現不可能な総量を示すことになる。
      for (let i = 0; i < values.length; i++) {
        values[i] = roundDose(perDoseValues[i] * dose.divisionsPerDay!);
      }
    }
  } else if (dose.per === "perDay" && dose.maxPerDose != null) {
    // 分割回数が不明なため自動では適用できない。黙って無視すると上限が失われるので注記する。
    uncappedNote = `1回あたり ${dose.maxPerDose}${dose.unit} を上限とすること`;
  } else if (dose.per === "perDay" && dose.maxPerKgPerDose != null) {
    uncappedNote = `1回あたり ${dose.maxPerKgPerDose}${dose.unit}/kg を上限とすること`;
  }

  const joined = values.length > 1 ? `${values[0]}-${values[1]}` : `${values[0]}`;
  const perLabel = dose.per === "perDose" ? "1回" : "1日";
  return {
    text: `${perLabel} ${joined}${dose.unit}`,
    clipped,
    basisLabel: `${w.label} ${roundDose(w.value)}kg`,
    perDose,
    uncappedNote,
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

/** 薬剤固有の指標・閾値を含め、患者に該当する腎機能用量を返す */
export function renalRuleForPatient(
  drug: Drug,
  patient: PatientState,
  route: "iv" | "po",
): RenalDoseRule | null {
  if (patient.rrt) return null;
  const set = drug.renalRules?.[route];
  if (!set) return null;
  const value = set.metric === "egfr" ? patient.egfr : cockcroftGault(patient);
  if (value == null) return null;
  return set.rules.find((rule) =>
    (rule.min == null || value >= rule.min) && (rule.max == null || value < rule.max),
  ) ?? null;
}

export function renalDoseForPatient(
  drug: Drug,
  patient: PatientState,
  route: "iv" | "po",
): string | null {
  if (patient.rrt) return renalDoseFor(drug, resolveRenalBand(patient), route);
  if (drug.renalRules?.[route]) return renalRuleForPatient(drug, patient, route)?.dose ?? null;
  return renalDoseFor(drug, resolveRenalBand(patient), route);
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
