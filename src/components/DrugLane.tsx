import { useMemo, useState } from "react";
import type { Drug, PatientMode, PatientState } from "../types";
import { REFERENCE } from "../data";
import { searchDrugs, drugSuggestions } from "../lib/search";
import { convertPerKg, resolveRenalBand } from "../lib/calc";
import {
  AWARE_BUCKETS,
  classesInLane,
  countByBucket,
  drugsInLane,
  filterByAware,
  isInLane,
  primaryDoseOf,
  type AwareBucket,
  type DrugLane as Lane,
} from "../lib/lanes";

const MODE_LABEL: Record<PatientMode, string> = { adult: "成人", pediatric: "小児" };

/* ---------------- 検索結果カード ---------------- */

function DrugCard({
  drug,
  lane,
  mode,
  patient,
  onOpen,
}: {
  drug: Drug;
  lane: Lane;
  mode: PatientMode;
  patient: PatientState;
  onOpen: () => void;
}) {
  const primary = primaryDoseOf(drug, lane, mode);
  const band = resolveRenalBand(patient);
  const renalDose = band
    ? (lane === "oral" ? drug.renalPo?.[band] : drug.renal?.[band]) ??
      (drug.renal?.[band] ?? drug.renalPo?.[band])
    : undefined;
  // 小児で体重未入力のときは mg/kg 表記のみとし、絶対量は出さない（FR-000-5）
  const conv =
    primary?.perKg && !(mode === "pediatric" && patient.weight == null)
      ? convertPerKg(primary.perKg, patient)
      : null;

  return (
    <button className="result" onClick={onOpen}>
      <div className="result-head">
        <span className="result-name">{drug.genericName.ja}</span>
        {drug.abbr && <span className="result-sub mono">{drug.abbr}</span>}
        <span className="result-sub">{drug.class}</span>
      </div>
      <div className="result-dose">
        通常量：<b>{primary ? primary.text : "原典に記載なし"}</b>
        {conv && <span className="mono">　→ {conv.text}</span>}
      </div>
      {renalDose && (
        <div className="result-dose" style={{ color: "var(--accent)" }}>
          この患者の腎機能では：<b>{renalDose}</b>
        </div>
      )}
      {(drug.requiresApplication || drug.consultSpecialist || drug.tdm) && (
        <div className="badges">
          {drug.requiresApplication && <span className="badge app">要申請</span>}
          {drug.consultSpecialist && <span className="badge consult">要コンサルト</span>}
          {drug.tdm && <span className="badge tdm">TDM対象</span>}
        </div>
      )}
    </button>
  );
}

/* ---------------- 集団の選択（レーンの第2階層） ---------------- */

export function ModePicker({
  lane,
  onPick,
}: {
  lane: Lane;
  onPick: (m: PatientMode) => void;
}) {
  return (
    <div className="gate-inner" style={{ maxWidth: "none" }}>
      <p className="gate-q">どちらの患者ですか？</p>
      <div className="gate-choices">
        <button className="gate-btn adult" onClick={() => onPick("adult")}>
          <strong>成人</strong>
          <span>成人の{lane === "oral" ? "内服" : "注射"}用量のみを表示します</span>
        </button>
        <button className="gate-btn paed" onClick={() => onPick("pediatric")}>
          <strong>小児</strong>
          <span>小児の{lane === "oral" ? "内服" : "注射"}用量のみを表示します</span>
        </button>
      </div>
      <p className="dose-note" style={{ marginTop: 14 }}>
        選択した集団の用量だけを表示します。取り違えを防ぐため、両方を同じ画面には並べません。
      </p>
    </div>
  );
}

/* ---------------- レーン本体 ---------------- */

export function DrugLaneView({
  lane,
  mode,
  patient,
  onOpenDrug,
  onOpenPage,
}: {
  lane: Lane;
  mode: PatientMode;
  patient: PatientState;
  onOpenDrug: (id: string) => void;
  onOpenPage: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [buckets, setBuckets] = useState<Set<AwareBucket>>(new Set());
  const [drugClass, setDrugClass] = useState<string | null>(null);

  const laneDrugs = useMemo(() => drugsInLane(lane, mode), [lane, mode]);

  // 検索は全薬剤に対して行い、レーン×集団で絞る
  const searched = useMemo(
    () => (query ? searchDrugs(query).filter((d) => isInLane(d, lane, mode)) : null),
    [query, lane, mode],
  );

  const bucketCounts = useMemo(() => countByBucket(laneDrugs), [laneDrugs]);
  const classes = useMemo(() => classesInLane(laneDrugs), [laneDrugs]);

  // 絞り込み結果。検索語があればそちらを優先する（入力欄が主、分類が副）
  const filtered = useMemo(() => {
    if (searched) return searched;
    if (lane === "oral") return filterByAware(laneDrugs, buckets);
    return drugClass ? laneDrugs.filter((d) => d.class === drugClass) : laneDrugs;
  }, [searched, laneDrugs, buckets, drugClass, lane]);

  const toggleBucket = (key: AwareBucket) => {
    setBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const card = (d: Drug) => (
    <DrugCard
      key={d.id}
      drug={d}
      lane={lane}
      mode={mode}
      patient={patient}
      onOpen={() => onOpenDrug(d.id)}
    />
  );

  return (
    <>
      <div className="searchbox">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="商品名・一般名・略語で検索（例：クラビット、レボフロキサシン、LVFX）"
          aria-label="薬剤を検索"
        />
      </div>

      {/* ---- 絞り込み（検索語がないときだけ出す） ---- */}
      {!query && lane === "oral" && (
        <section className="section" style={{ marginTop: 0 }}>
          <h3>AWaRe分類で絞り込む</h3>
          <p className="lane-intro">
            WHOは抗菌薬を Access・Watch・Reserve の3つに分類しています。
            <b>Accessの使用を増やし、Watch・Reserveをなるべく減らす</b>のがWHOの方針で、
            使用する抗菌薬全体のうちAccessの割合を60%以上にすることが目標とされています。
            <button className="link-btn" onClick={() => onOpenPage("stewardship")}>
              適正使用指針・AWaRe分類の全文を見る →
            </button>
          </p>
          <div className="tabs">
            {AWARE_BUCKETS.map((b) => (
              <button
                key={b.key}
                className="tab"
                aria-pressed={buckets.has(b.key)}
                disabled={bucketCounts[b.key] === 0}
                onClick={() => toggleBucket(b.key)}
                title={b.sub}
              >
                {b.label}
                <span className="tab-count">{bucketCounts[b.key]}</span>
              </button>
            ))}
          </div>
          <p className="dose-note">
            {buckets.size > 0
              ? [...buckets].map((k) => AWARE_BUCKETS.find((b) => b.key === k)?.sub).join(" ／ ")
              : "AWaRe分類は抗菌薬を対象とするため、抗真菌薬・抗ウイルス薬・抗結核薬などは分類対象外で「その他」に含まれます。"}
          </p>
          <p className="source-line">原典 p.{REFERENCE.aware.source.pages.join(", ")}</p>
        </section>
      )}

      {!query && lane === "injectable" && (
        <section className="section" style={{ marginTop: 0 }}>
          <h3>系統で絞り込む</h3>
          <div className="tabs">
            {classes.map((c) => (
              <button
                key={c.name}
                className="tab"
                aria-pressed={drugClass === c.name}
                onClick={() => setDrugClass(drugClass === c.name ? null : c.name)}
              >
                {c.name}
                <span className="tab-count">{c.count}</span>
              </button>
            ))}
          </div>
          <button className="tile" style={{ marginTop: 10 }} onClick={() => onOpenPage("formulary")}>
            <b>当院採用注射抗菌薬一覧 →</b>
            <span>規格・薬価・投与時間・配合変化を一覧で確認できます</span>
          </button>
        </section>
      )}

      {/* ---- 一覧 ---- */}
      <section className="section">
        <h3>
          {query ? `「${query}」の検索結果` : "薬剤一覧"}
          <span className="count-tag">
            {filtered.length}件 ／ {MODE_LABEL[mode]}・{lane === "oral" ? "内服" : "注射"}
          </span>
        </h3>
        <div className="list">
          {filtered.map(card)}
          {filtered.length === 0 && query && (
            <>
              <p className="empty">
                「{query}」に一致する{MODE_LABEL[mode]}の
                {lane === "oral" ? "内服薬" : "注射薬"}はありません。
              </p>
              {drugSuggestions(query).filter((d) => isInLane(d, lane, mode)).length > 0 && (
                <>
                  <p className="dose-note">もしかして：</p>
                  {drugSuggestions(query)
                    .filter((d) => isInLane(d, lane, mode))
                    .map(card)}
                </>
              )}
            </>
          )}
          {filtered.length === 0 && !query && (
            <p className="empty">該当する薬剤がありません。絞り込みを解除してください。</p>
          )}
        </div>
      </section>
    </>
  );
}
