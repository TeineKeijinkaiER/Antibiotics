import { DRUGS, ORGANISMS, DISEASES, OFFLABEL } from "../data";
import type { Drug, Organism, Disease, OffLabelUse } from "../types";
import { normalize, matchScore } from "./normalize";

type Indexed<T> = { item: T; keys: string[] };

function buildIndex<T>(items: T[], keysOf: (t: T) => (string | null | undefined)[]): Indexed<T>[] {
  return items.map((item) => ({
    item,
    keys: keysOf(item)
      .filter((k): k is string => !!k)
      .map(normalize)
      .filter((k) => k.length > 0),
  }));
}

/** 一般名（英・カナ）／商品名／略語／系統／別名 をまとめて検索対象にする（FR-002-1） */
const DRUG_INDEX = buildIndex<Drug>(DRUGS, (d) => [
  d.genericName.en,
  d.genericName.ja,
  d.abbr,
  d.class,
  ...d.brandNames,
  ...(d.aliases ?? []),
]);

/** 学名／短縮名／日本語名／略号／通称／カナ（FR-007-1） */
const ORGANISM_INDEX = buildIndex<Organism>(ORGANISMS, (o) => [
  o.scientificName,
  o.shortName,
  o.japaneseName,
  o.group,
  ...o.aliases,
]);

const DISEASE_INDEX = buildIndex<Disease>(DISEASES, (d) => [
  d.name,
  d.specialty,
  ...d.aliases,
]);

function search<T>(index: Indexed<T>[], query: string, limit = 40): T[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { item: T; score: number }[] = [];
  for (const entry of index) {
    let best = 0;
    for (const key of entry.keys) {
      const s = matchScore(key, q);
      if (s > best) best = s;
    }
    if (best > 0) scored.push({ item: entry.item, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

export const searchDrugs = (q: string, limit?: number) =>
  search(DRUG_INDEX, q, limit);
export const searchOrganisms = (q: string, limit?: number) =>
  search(ORGANISM_INDEX, q, limit);
export const searchDiseases = (q: string, limit?: number) =>
  search(DISEASE_INDEX, q, limit);

/** 検索結果0件のときに出す近い候補（FR-002-5）— 先頭2文字での再検索 */
export function drugSuggestions(query: string, limit = 5): Drug[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  return search(DRUG_INDEX, q.slice(0, 2), limit);
}

/* ---------- 適応外使用の双方向インデックス（FR-006-1〜3） ---------- */

const OFFLABEL_BY_DRUG = new Map<string, OffLabelUse[]>();
const OFFLABEL_BY_DISEASE = new Map<string, OffLabelUse[]>();

for (const use of OFFLABEL) {
  const byDrug = OFFLABEL_BY_DRUG.get(use.drugId) ?? [];
  byDrug.push(use);
  OFFLABEL_BY_DRUG.set(use.drugId, byDrug);

  for (const diseaseId of use.diseaseIds) {
    const byDisease = OFFLABEL_BY_DISEASE.get(diseaseId) ?? [];
    byDisease.push(use);
    OFFLABEL_BY_DISEASE.set(diseaseId, byDisease);
  }
}

export const offLabelForDrug = (drugId: string): OffLabelUse[] =>
  OFFLABEL_BY_DRUG.get(drugId) ?? [];

export const offLabelForDisease = (diseaseId: string): OffLabelUse[] =>
  OFFLABEL_BY_DISEASE.get(diseaseId) ?? [];

/** 疾患名で検索し、ヒットした疾患ごとの適応外使用を返す（FR-006-3） */
export function searchOffLabelByDisease(
  query: string,
): { disease: Disease; uses: OffLabelUse[] }[] {
  return searchDiseases(query)
    .map((disease) => ({ disease, uses: offLabelForDisease(disease.id) }))
    .filter((r) => r.uses.length > 0);
}

/** 薬剤名で検索し、ヒットした薬剤ごとの適応外使用を返す（FR-006-2） */
export function searchOffLabelByDrug(
  query: string,
): { drug: Drug; uses: OffLabelUse[] }[] {
  return searchDrugs(query)
    .map((drug) => ({ drug, uses: offLabelForDrug(drug.id) }))
    .filter((r) => r.uses.length > 0);
}
