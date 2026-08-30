import type {
  Drug,
  Organism,
  Disease,
  OffLabelUse,
  AntibiogramRow,
  ProphylaxisData,
  ReferenceData,
  InfectionEntry,
  StewardshipTopic,
} from "../types";

import betalactam from "./drugs.betalactam.json";
import antibacterial from "./drugs.antibacterial.json";
import antifungalAntiviral from "./drugs.antifungal-antiviral.json";
import organismsJson from "./organisms.json";
import diseasesJson from "./diseases.json";
import offlabelJson from "./offlabel.json";
import antibiogramJson from "./antibiogram.json";
import prophylaxisJson from "./prophylaxis.json";
import referenceJson from "./reference.json";
import infectionsJson from "./infections.json";
import stewardshipTopicsJson from "./stewardship-topics.json";

export const DRUGS: Drug[] = [
  ...(betalactam as Drug[]),
  ...(antibacterial as Drug[]),
  ...(antifungalAntiviral as Drug[]),
].sort((a, b) => a.genericName.en.localeCompare(b.genericName.en));

export const ORGANISMS: Organism[] = organismsJson as Organism[];
export const DISEASES: Disease[] = diseasesJson as Disease[];
export const OFFLABEL: OffLabelUse[] = offlabelJson as OffLabelUse[];

export const ANTIBIOGRAM = antibiogramJson as unknown as {
  meta: {
    year: string;
    period: string;
    facility: string;
    gnrColumns: string[];
    gpcColumns: string[];
    note: string;
    empiricNote: string;
    verified: boolean;
    /** 原本との照合を完了した日（verified が true のときに入る） */
    verifiedOn?: string;
    verificationNote: string;
  };
  rows: AntibiogramRow[];
};

export const PROPHYLAXIS = prophylaxisJson as unknown as ProphylaxisData;
export const REFERENCE = referenceJson as unknown as ReferenceData;

export const DRUG_BY_ID = new Map(DRUGS.map((d) => [d.id, d]));
/** アンチバイオグラムの略号から薬剤詳細へ遷移するための索引 */
export const DRUG_BY_ABBR = new Map(
  DRUGS.filter((d) => d.abbr).map((d) => [d.abbr!, d]),
);
export const ORGANISM_BY_ID = new Map(ORGANISMS.map((o) => [o.id, o]));
export const DISEASE_BY_ID = new Map(DISEASES.map((d) => [d.id, d]));

/* ---------------- 感染症別（FR-017） ---------------- */

export const INFECTIONS = (infectionsJson as unknown as InfectionEntry[]).filter((i) => !i.retired);
export const INFECTION_BY_ID = new Map(INFECTIONS.map((i) => [i.id, i]));
/**
 * 「適正使用の手引き」の小項目に出さないもの。
 * - inpatient-organisms / acute-diarrhea-food: 疾患ページへ統合済みのため重複表示しない。
 * - not-improving / end-of-life: 手引きの一般論であり当院の運用（感染症科・ICT／ASTへの相談）で扱うため、
 *   参照アプリの項目としては廃止した。原典データは残してある。
 */
const HIDDEN_STEWARDSHIP_TOPIC_IDS = new Set([
  "inpatient-organisms",
  "acute-diarrhea-food",
  "not-improving",
  "end-of-life",
]);
export const STEWARDSHIP_TOPICS = (stewardshipTopicsJson as unknown as StewardshipTopic[]).filter(
  (topic) => !HIDDEN_STEWARDSHIP_TOPIC_IDS.has(topic.id),
);
export const STEWARDSHIP_TOPIC_BY_ID = new Map(STEWARDSHIP_TOPICS.map((t) => [t.id, t]));

/** 感染症別レーンの出典。全画面のフッタに出す（FR-017-7） */
export const STEWARDSHIP_GUIDE = {
  title: "抗微生物薬適正使用の手引き",
  edition: "第四版",
  publisher: "厚生労働省 健康･生活衛生局 感染症対策部 感染症対策課",
  books: { outpatient: "医科・外来編", inpatient: "医科・入院編", both: "医科・外来編／入院編" },
};

/** 原典の版情報。全画面のフッタに表示する（要件 NFR-010） */
export const MANUAL_EDITION = {
  label: "第9版",
  issuedOn: "2026-04-01",
  facility: "手稲渓仁会医療センター",
  title: "抗菌薬投与マニュアル",
  author: "感染制御管理室",
};
