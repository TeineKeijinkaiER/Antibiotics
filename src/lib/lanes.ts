/**
 * 大項目レーンの分類（UI再編 版2.0 §1.1）
 *
 * 入口は原典の章立てに合わせて「内服薬／注射薬／菌名／周術期」の4つ。
 * 内服薬・注射薬は、剤形に加えて患者集団（成人／小児）で絞り込む。
 * 菌名・周術期は患者集団に依存しないため、ここでは扱わない。
 */

import { DRUGS } from "../data";
import type { AwareClass, Drug, DrugCategory, PatientMode, Route } from "../types";

export type DrugLane = "oral" | "injectable";

export const LANE_LABEL: Record<DrugLane, string> = {
  oral: "内服薬",
  injectable: "注射薬",
};

/** そのレーンが対象とする投与経路 */
const LANE_ROUTES: Record<DrugLane, Route[]> = {
  oral: ["po"],
  injectable: ["iv", "im", "inhalation"],
};

/** 選択中の集団で、そのレーンの経路の用量を持つか */
export function isInLane(drug: Drug, lane: DrugLane, mode: PatientMode): boolean {
  const dosing = mode === "adult" ? drug.adult : drug.pediatric;
  if (!dosing) return false;
  return LANE_ROUTES[lane].some((route) => (dosing[route]?.length ?? 0) > 0);
}

/** レーン×集団に属する薬剤。原典の並び順を保つ */
export function drugsInLane(lane: DrugLane, mode: PatientMode): Drug[] {
  return DRUGS.filter((d) => isInLane(d, lane, mode));
}

/**
 * そのレーンで主に見せる用量。
 * 内服薬レーンなら経口、注射薬レーンなら注射（iv → im → 吸入の順）を返す。
 */
export function primaryDoseOf(drug: Drug, lane: DrugLane, mode: PatientMode) {
  const dosing = mode === "adult" ? drug.adult : drug.pediatric;
  if (!dosing) return undefined;
  for (const route of LANE_ROUTES[lane]) {
    const doses = dosing[route];
    if (doses && doses.length > 0) return doses[0];
  }
  return undefined;
}

/* ---------------- AWaRe分類による絞り込み（内服薬レーンのみ） ---------------- */

/**
 * 絞り込みボタンの区分。
 *
 * 原典 p.74 の表には Not recommended（アトバコン1剤）の欄もあるが、
 * 当院では使用しない方針のためボタンとしては設けない。該当薬剤は「その他」に含める。
 * 薬剤詳細のAWaReバッジには原典どおりの分類が表示されるため、原典の情報は失われない。
 */
export type AwareBucket = "Access" | "Watch" | "Reserve" | "other";

export const AWARE_BUCKETS: { key: AwareBucket; label: string; sub: string }[] = [
  { key: "Access", label: "Access", sub: "第一選択・第二選択として推奨" },
  { key: "Watch", label: "Watch", sub: "耐性化の懸念があり使用を抑える" },
  { key: "Reserve", label: "Reserve", sub: "他に選択肢がない場合の最終手段" },
  { key: "other", label: "その他", sub: "原典のAWaRe分類表に記載のないもの" },
];

const BUCKET_OF: Partial<Record<AwareClass, AwareBucket>> = {
  Access: "Access",
  Watch: "Watch",
  Reserve: "Reserve",
};

/** 薬剤が属する絞り込み区分。分類がない薬剤と Not recommended は "other" */
export function awareBucketOf(drug: Drug): AwareBucket {
  return (drug.aware && BUCKET_OF[drug.aware]) ?? "other";
}

/** 選択中の区分で薬剤を絞り込む。未選択（空）なら全件を返す */
export function filterByAware(drugs: Drug[], selected: Set<AwareBucket>): Drug[] {
  if (selected.size === 0) return drugs;
  return drugs.filter((d) => selected.has(awareBucketOf(d)));
}

export function countByBucket(drugs: Drug[]): Record<AwareBucket, number> {
  const counts: Record<AwareBucket, number> = { Access: 0, Watch: 0, Reserve: 0, other: 0 };
  for (const d of drugs) counts[awareBucketOf(d)] += 1;
  return counts;
}

/**
 * AWaRe分類対象外（"other"）の薬剤を、系統ジャンルで分ける。
 *
 * WHOのAWaRe分類は抗菌薬（antibacterial）のみを対象とするため、
 * 抗真菌薬・抗ウイルス薬・抗結核薬・駆虫薬はいずれも分類の対象外で「その他」に一括りになる。
 * 「その他」の中で薬剤名をいきなり並べると18〜20剤が一列に並んでしまうため、
 * 系統ジャンルのボタンをもう1階層挟む。
 */
export const OTHER_GENRE_LABEL: Record<DrugCategory, string> = {
  antibacterial: "抗菌薬（分類外）",
  antifungal: "抗真菌薬",
  antiviral: "抗ウイルス薬",
  antituberculous: "抗結核薬",
  anthelmintic: "駆虫薬",
};

const OTHER_GENRE_ORDER: DrugCategory[] = [
  "antifungal",
  "antiviral",
  "antituberculous",
  "anthelmintic",
  "antibacterial",
];

export function otherGenresInLane(
  drugs: Drug[],
): { category: DrugCategory; label: string; count: number }[] {
  const otherDrugs = drugs.filter((d) => awareBucketOf(d) === "other");
  const counts = new Map<DrugCategory, number>();
  for (const d of otherDrugs) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
  return OTHER_GENRE_ORDER.filter((c) => counts.has(c)).map((category) => ({
    category,
    label: OTHER_GENRE_LABEL[category],
    count: counts.get(category)!,
  }));
}

/* ---------------- 系統による絞り込み（注射薬レーン） ---------------- */

/** そのレーン×集団に実在する系統を、薬剤数の多い順に返す */
export function classesInLane(drugs: Drug[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of drugs) counts.set(d.class, (counts.get(d.class) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
}
