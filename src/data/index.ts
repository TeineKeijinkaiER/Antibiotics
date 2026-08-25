import type {
  Drug,
  Organism,
  Disease,
  OffLabelUse,
  AntibiogramRow,
} from "../types";

import betalactam from "./drugs.betalactam.json";
import antibacterial from "./drugs.antibacterial.json";
import antifungalAntiviral from "./drugs.antifungal-antiviral.json";
import organismsJson from "./organisms.json";
import diseasesJson from "./diseases.json";
import offlabelJson from "./offlabel.json";
import antibiogramJson from "./antibiogram.json";

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
    verificationNote: string;
  };
  rows: AntibiogramRow[];
};

export const DRUG_BY_ID = new Map(DRUGS.map((d) => [d.id, d]));
export const ORGANISM_BY_ID = new Map(ORGANISMS.map((o) => [o.id, o]));
export const DISEASE_BY_ID = new Map(DISEASES.map((d) => [d.id, d]));

/** 原典の版情報。全画面のフッタに表示する（要件 NFR-010） */
export const MANUAL_EDITION = {
  label: "第9版",
  issuedOn: "2026-04-01",
  facility: "手稲渓仁会医療センター",
  title: "抗菌薬投与マニュアル",
  author: "感染制御管理室",
};
