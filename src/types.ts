/**
 * 抗菌薬投与ナビ — データ型定義
 *
 * 全レコードは原典（手稲渓仁会医療センター『抗菌薬投与マニュアル 第9版』）の
 * ページ番号を `source` として必ず持つ。scripts/validate-data.mjs で強制される。
 */

export type Source = {
  /** 原典の版 */
  edition: number;
  /** 原典のページ番号 */
  pages: number[];
};

export type DrugCategory =
  | "antibacterial"
  | "antifungal"
  | "antiviral"
  | "antituberculous"
  | "anthelmintic";

export type AwareClass = "Access" | "Watch" | "Reserve" | "NotRecommended";

/** mg/kg 系用量の体重基準 */
export type WeightBasis = "actual" | "ideal" | "adjusted";

/** 体重あたり用量。体重が入力されていれば絶対量に換算して併記する */
export type PerKgDose = {
  /** 1回量 or 1日量の数値。範囲は [min, max] */
  amount: number | [number, number];
  unit: "mg" | "g" | "µg";
  /** "perDose" = 1回あたり / "perDay" = 1日あたり */
  per: "perDose" | "perDay";
  basis: WeightBasis;
  /** 1回量の上限（換算値をクリップする） */
  maxPerDose?: number;
  /** 1日量の上限 */
  maxPerDay?: number;
};

/** 1つの用法用量。原典の表記をそのまま `text` に保持する */
export type Dose = {
  /** 適応名。null は一般（適応を限定しない標準量） */
  indication: string | null;
  /** 原典どおりの用量表記 */
  text: string;
  /** 体重換算が可能な場合の構造化データ */
  perKg?: PerKgDose;
  /** 原典で「＊適応外使用」と注記された用量 */
  offLabel?: boolean;
  note?: string;
};

export type Route = "iv" | "po" | "im" | "inhalation";

/** 腎機能区分。原典 p.16-22 の区分に対応 */
export type RenalBand = "gt50" | "ccr10_50" | "lt10" | "hd" | "chdf";

export const RENAL_BAND_LABEL: Record<RenalBand, string> = {
  gt50: "CCr > 50 mL/min",
  ccr10_50: "CCr 10–50 mL/min",
  lt10: "CCr < 10 mL/min",
  hd: "血液透析 (HD)",
  chdf: "CHDF",
};

export type RenalDosing = Partial<Record<RenalBand, string>>;

export type TdmTarget = {
  type: "trough" | "peak" | "auc";
  /** 表示用の値表記 */
  value: string;
  unit: string;
  /** どの病態のときの目標値か。null は通常 */
  condition: string | null;
};

export type TdmProfile = {
  targets: TdmTarget[];
  sampling: { trough?: string; peak?: string };
  /** 何ドーズ目からTDMを行うか */
  firstTdmDose?: string;
  loadingDose?: string;
  /** 上限量などの警告文 */
  cautions?: string[];
  /** 投与設計ツールのキー。存在すれば詳細画面から導線を出す */
  designer?: "vancomycin" | "teicoplanin" | "aminoglycoside" | "voriconazole";
  source: Source;
};

export type Formulation = {
  brandName: string;
  strength: string;
  /** 薬価（円） */
  price?: number;
  /** 静注（ワンショット）可否 */
  ivPush?: boolean;
  /** 点滴静注の投与時間。false は不可 */
  drip?: string | false;
  /** 筋注可否 */
  im?: boolean;
  notes?: string[];
  /** 配合変化を起こす薬剤の略号 */
  incompatibleWith?: string[];
  source: Source;
};

export type Drug = {
  id: string;
  genericName: { en: string; ja: string };
  brandNames: string[];
  abbr: string | null;
  /** 系統（第4世代セフェム系 など） */
  class: string;
  category: DrugCategory;
  aware?: AwareClass;
  /** 使用申請書が必要（原典 p.8） */
  requiresApplication?: boolean;
  /** 「※専門家にコンサルテーション」の注記がある */
  consultSpecialist?: boolean;
  /** 原典★印: 腎機能低下時も常用量投与が可能 */
  renalAdjustmentNotRequired?: boolean;
  /** 検索用の別名。一般名・商品名・略語は自動で検索対象になるため、それ以外を書く */
  aliases?: string[];

  adult?: Partial<Record<Route, Dose[]>>;
  pediatric?: Partial<Record<Route, Dose[]>>;

  /** 腎機能低下時（静注）。経口は renalPo */
  renal?: RenalDosing;
  renalPo?: RenalDosing;
  /** 腎機能について原典が特記する事項 */
  renalNote?: string;

  tdm?: TdmProfile;
  formulations?: Formulation[];
  source: Source;
};

export type Disease = {
  id: string;
  name: string;
  aliases: string[];
  specialty?: string;
};

/** 適応外使用の区分（原典 p.52 / p.54 / p.56 の3見出し） */
export type OffLabelCategory =
  | "indication"
  | "indication_and_dosage"
  | "dosage";

export const OFFLABEL_CATEGORY_LABEL: Record<OffLabelCategory, string> = {
  indication: "適応症に関する使用",
  indication_and_dosage: "適応症及び用法・用量に関する使用",
  dosage: "用法・用量に関する使用",
};

export type OffLabelUse = {
  id: string;
  drugId: string;
  /** 原典に記載された製剤名（規格まで含む） */
  productLabel: string;
  category: OffLabelCategory;
  diseaseIds: string[];
  /** 用法用量が指定されている場合 */
  dosageText?: string;
  source: Source;
};

export type GramStain =
  | "gram_positive_coccus"
  | "gram_negative_rod"
  | "anaerobe";

export type Organism = {
  id: string;
  scientificName: string;
  shortName?: string;
  japaneseName: string;
  /** 学名・短縮名・日本語名以外の検索別名（略号・通称・カナ） */
  aliases: string[];
  gramStain: GramStain;
  group?: string;
};

export type AntibiogramSetting = "inpatient" | "outpatient";

export type AntibiogramRow = {
  organismId: string;
  setting: AntibiogramSetting;
  /** 検出株数 */
  isolates: number;
  /** 抗菌薬略号 → 感性率(%)。データなしの薬剤はキーを持たない */
  susceptibility: Record<string, number>;
  /** ESBL産生菌の割合 など原典の補足 */
  annotations?: string[];
  source: Source;
};

export type AntibiogramMeta = {
  year: string;
  period: string;
  /** 表の列順（原典の並び） */
  gnrColumns: string[];
  gpcColumns: string[];
  note: string;
};

/** 周術期予防抗菌薬（原典 p.48-50） */
export type ProphylaxisEntry = {
  id: string;
  /** ターゲットとする常在菌のグループ（原典の3分類） */
  targetGroup: 1 | 2 | 3;
  field: string;
  organs: string[];
  recommended: string[];
  source: Source;
};

export type WoundClass = {
  id: string;
  label: string;
  indication: string;
  criteria: string;
  source: Source;
};

export type BetaLactamAllergyRow = {
  id: string;
  woundClass: string;
  gramPositive: string[];
  gramNegative: string[];
  anaerobe: string[];
  source: Source;
};

export type ProphylaxisDose = {
  drug: string;
  drugId: string;
  bands: {
    weightMin: number | null;
    weightMax: number | null;
    text: string;
    perKg?: PerKgDose;
  }[];
  source: Source;
};

export type ProphylaxisData = {
  meta: { purpose: string[]; selectionPrinciples: string[]; source: Source };
  woundClasses: WoundClass[];
  entries: ProphylaxisEntry[];
  targetGroupLabels: Record<string, string>;
  betaLactamAllergy: BetaLactamAllergyRow[];
  timing: string[];
  duration: string[];
  doses: ProphylaxisDose[];
};

/** 参考情報（アナフィラキシー・曝露後予防・小児体重・PCG持続静注・適正使用指針・AWaRe） */
export type ReferenceData = {
  anaphylaxis: {
    title: string;
    intro: string;
    basicPrecautions: string[];
    allergyHistory: string[];
    observation: string[];
    severity: { level: string; definition: string }[];
    drugs: { name: string; role: string }[];
    steps: { phase: string; items: string[] }[];
    source: Source;
  };
  postExposureProphylaxis: {
    title: string;
    intro: string;
    entries: {
      id: string;
      disease: string;
      regimens: { condition: string; detail: string }[];
    }[];
    notes: string[];
    source: Source;
  };
  pediatricWeight: {
    title: string;
    table: { age: string; weight: number }[];
    tableSource: string;
    formulas: { name: string; expression: string }[];
    vonHarnack: { age: string; ratio: string }[];
    caution: string;
    source: Source;
  };
  pcgContinuousInfusion: {
    title: string;
    rationale: string;
    cautions: string[];
    loading: string;
    regimens: {
      dailyUnits: number;
      dailyLabel: string;
      routes: {
        route: string;
        detail: string;
        waterPerDay?: string;
        concentration?: string;
        potassium?: string;
      }[];
    }[];
    source: Source;
  };
  stewardship: {
    title: string;
    objectives: string[];
    sections: { heading: string; items: string[] }[];
    applicationRule: { heading: string; drugs: string[]; items: string[] };
    source: Source;
  };
  aware: {
    title: string;
    intro: string;
    groups: { category: string; drugs: { generic: string; brand: string }[] }[];
    source: Source;
  };
};

export type PatientMode = "adult" | "pediatric";

export type Sex = "male" | "female";

export type RenalReplacement = "none" | "hd" | "chdf";

export type PatientState = {
  age: number | null;
  sex: Sex | null;
  weight: number | null;
  height: number | null;
  scr: number | null;
  egfr: number | null;
  rrt: RenalReplacement;
};
