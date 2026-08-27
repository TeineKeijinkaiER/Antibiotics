import { useMemo, useState } from "react";
import type { OffLabelCategory, OffLabelUse, PatientMode } from "../types";
import { OFFLABEL_CATEGORY_LABEL } from "../types";
import { searchOffLabelByDisease, searchOffLabelByDrug } from "../lib/search";
import { OFFLABEL, DRUG_BY_ID, DISEASE_BY_ID } from "../data";

type By = "disease" | "drug";

const CATEGORIES: OffLabelCategory[] = [
  "indication",
  "indication_and_dosage",
  "dosage",
];

function UseRow({
  use,
  onOpenDrug,
}: {
  use: OffLabelUse;
  onOpenDrug: (id: string) => void;
}) {
  const drug = DRUG_BY_ID.get(use.drugId);
  return (
    <div className="dose-row">
      <div className="dose-ind">{OFFLABEL_CATEGORY_LABEL[use.category]}</div>
      <div className="dose-text">
        <button className="link-btn" style={{ fontSize: 15, fontWeight: 700 }} onClick={() => onOpenDrug(use.drugId)}>
          {drug?.genericName.ja ?? use.drugId}
        </button>
      </div>
      <div className="dose-note">{use.productLabel}</div>
      <div className="dose-text" style={{ fontSize: 13.5 }}>
        {use.diseaseIds.map((id) => DISEASE_BY_ID.get(id)?.name ?? id).join("、")}
      </div>
      {use.dosageText && <div className="offlabel-dose">{use.dosageText}</div>}
      <div className="source-line">原典 p.{use.source.pages.join(", ")}</div>
    </div>
  );
}

export function OffLabelSearch({
  onOpenDrug,
  mode,
}: {
  onOpenDrug: (id: string) => void;
  mode: PatientMode;
}) {
  const [by, setBy] = useState<By>("disease");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<OffLabelCategory[]>(CATEGORIES);

  const toggleCategory = (c: OffLabelCategory) =>
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const inCategory = (u: OffLabelUse) =>
    categories.includes(u.category) && (u.populations ?? ["adult"]).includes(mode);

  const results = useMemo(() => {
    if (!query.trim()) {
      return [
        {
          heading: `全 ${OFFLABEL.filter(inCategory).length} 件`,
          uses: OFFLABEL.filter(inCategory),
        },
      ];
    }
    if (by === "disease") {
      return searchOffLabelByDisease(query)
        .map((r) => ({ heading: r.disease.name, uses: r.uses.filter(inCategory) }))
        .filter((r) => r.uses.length > 0);
    }
    return searchOffLabelByDrug(query)
      .map((r) => ({ heading: r.drug.genericName.ja, uses: r.uses.filter(inCategory) }))
      .filter((r) => r.uses.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [by, query, categories, mode]);

  return (
    <div>
      <div className="detail-head">
        <h2>適応外使用</h2>
        <p className="en">
          {mode === "adult" ? "成人" : "小児"}で原典に明示された項目を、薬剤名・疾患名から検索できます（原典 p.52-56）
        </p>
      </div>

      <div className="banner danger">
        下記は適応外ではあるが治療上必要な適応症・用法用量であることを病院としてコンセンサスが得られたものです。
        薬機法上は適応外使用であるため、<b>患者への十分な説明と文書での同意</b>を得ること。
        「適応症及び用法・用量に関する使用」「用法・用量に関する使用」は<b>重症例での使用を検討</b>し、
        通常の感染症治療においては適応範囲内での治療を行うこと。
      </div>

      <div className="tabs">
        <button className="tab" aria-pressed={by === "disease"} onClick={() => setBy("disease")}>
          疾患名から探す
        </button>
        <button className="tab" aria-pressed={by === "drug"} onClick={() => setBy("drug")}>
          薬剤名から探す
        </button>
      </div>

      <div className="searchbox">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            by === "disease"
              ? "例：壊死性筋膜炎、ベル麻痺、脳膿瘍、PCP"
              : "例：クリンダマイシン、CLDM、リファジン"
          }
          aria-label={by === "disease" ? "疾患名で検索" : "薬剤名で検索"}
        />
      </div>

      <div className="tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className="tab"
            aria-pressed={categories.includes(c)}
            onClick={() => toggleCategory(c)}
          >
            {OFFLABEL_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="empty">該当する適応外使用はありません。</p>
      ) : (
        results.map((r) => (
          <section className="section" key={r.heading}>
            <h3>{r.heading}</h3>
            {r.uses.map((u) => (
              <UseRow key={u.id + r.heading} use={u} onOpenDrug={onOpenDrug} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
