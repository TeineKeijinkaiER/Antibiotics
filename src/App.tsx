import { useEffect, useMemo, useState } from "react";
import type { PatientMode, PatientState, Drug } from "./types";
import { DRUGS, DRUG_BY_ID, ORGANISM_BY_ID, MANUAL_EDITION } from "./data";
import { searchDrugs, searchOrganisms, drugSuggestions } from "./lib/search";
import { resolveRenalBand, convertPerKg } from "./lib/calc";
import { PatientPanel, emptyPatient } from "./components/PatientPanel";
import { DrugDetail } from "./components/DrugDetail";
import { OrganismDetail } from "./components/OrganismDetail";
import { OffLabelSearch } from "./components/OffLabelSearch";
import { Designer, DESIGNERS } from "./components/Designer";
import { SurgicalProphylaxis } from "./components/SurgicalProphylaxis";
import { Formulary } from "./components/Formulary";
import {
  Anaphylaxis,
  PostExposureProphylaxis,
  PediatricWeight,
  PcgContinuousInfusion,
  Stewardship,
  Amr,
} from "./components/Reference";
import {
  getFavorites,
  getHistory,
  toggleFavorite,
  pushHistory,
  clearHistory,
  type ItemRef,
} from "./lib/storage";
import { subscribeSwStatus, getSwStatus, applyUpdate, type SwStatus } from "./lib/sw";

type View =
  | { type: "home" }
  | { type: "drug"; id: string }
  | { type: "organism"; id: string }
  | { type: "offlabel" }
  | { type: "designer"; key: string }
  | { type: "page"; key: PageKey };

type PageKey =
  | "prophylaxis"
  | "formulary"
  | "anaphylaxis"
  | "postexposure"
  | "pediatric-weight"
  | "pcg"
  | "stewardship"
  | "amr";

const PAGES: { key: PageKey; title: string; sub: string }[] = [
  { key: "prophylaxis", title: "周術期予防抗菌薬", sub: "領域から推奨薬・1回量・投与期間" },
  { key: "pcg", title: "ペニシリンG持続静注", sub: "1日総量と経路から調製手順" },
  { key: "anaphylaxis", title: "アナフィラキシー対応", sub: "重症度別の救急処置" },
  { key: "postexposure", title: "曝露後予防投与", sub: "HBV・HIV・水痘・インフルエンザほか" },
  { key: "formulary", title: "当院採用注射抗菌薬一覧", sub: "規格・薬価・投与時間・配合変化" },
  { key: "pediatric-weight", title: "小児の体重・薬用量", sub: "年齢別体重、Augsberger式ほか" },
  { key: "stewardship", title: "適正使用指針・AWaRe", sub: "申請ルールとAWaRe分類" },
  { key: "amr", title: "AMR対策", sub: "抗微生物薬適正使用の手引き・参考文献" },
];

type SearchTarget = "drug" | "organism";

const MODE_LABEL: Record<PatientMode, string> = { adult: "成人", pediatric: "小児" };

/* ---------------- mode gate（要件 FR-000-1） ---------------- */

function ModeGate({ onPick }: { onPick: (m: PatientMode) => void }) {
  return (
    <div className="gate">
      <div className="gate-inner">
        <h1>抗菌薬投与ナビ</h1>
        <p className="sub">
          {MANUAL_EDITION.facility}『{MANUAL_EDITION.title}』{MANUAL_EDITION.label}（
          {MANUAL_EDITION.issuedOn}）
        </p>
        <p className="gate-q">どちらの患者ですか？</p>
        <div className="gate-choices">
          <button className="gate-btn adult" onClick={() => onPick("adult")}>
            <strong>成人</strong>
            <span>成人の用量のみを表示します</span>
          </button>
          <button className="gate-btn paed" onClick={() => onPick("pediatric")}>
            <strong>小児</strong>
            <span>小児の用量のみを表示します</span>
          </button>
        </div>
        <p className="disclaimer">
          本アプリは院内マニュアルの閲覧を支援するものであり、診断・治療方針の提示は行いません。
          示される投与量は当院でコンセンサスの得られた標準的な投与量であり、
          最終的な投与判断は主治医が行います。使用時は添付文書を改めて精読してください。
          入力した患者条件は端末内にのみ保持され、外部に送信されません。
        </p>
      </div>
    </div>
  );
}

/* ---------------- 検索結果カード（要件 FR-002-3 / FR-004-1） ---------------- */

function DrugCard({
  drug,
  mode,
  patient,
  onOpen,
}: {
  drug: Drug;
  mode: PatientMode;
  patient: PatientState;
  onOpen: () => void;
}) {
  const dosing = mode === "adult" ? drug.adult : drug.pediatric;
  const primary = dosing?.iv?.[0] ?? dosing?.po?.[0] ?? dosing?.im?.[0] ?? dosing?.inhalation?.[0];
  const band = resolveRenalBand(patient);
  const renalDose = band ? (drug.renal?.[band] ?? drug.renalPo?.[band]) : undefined;
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
      {(drug.requiresApplication || drug.consultSpecialist) && (
        <div className="badges">
          {drug.requiresApplication && <span className="badge app">要申請</span>}
          {drug.consultSpecialist && <span className="badge consult">要コンサルト</span>}
        </div>
      )}
    </button>
  );
}

/* ---------------- app ---------------- */

export default function App() {
  const [mode, setMode] = useState<PatientMode | null>(null);
  const [patient, setPatient] = useState<PatientState>(emptyPatient);
  const [view, setView] = useState<View>({ type: "home" });
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<SearchTarget>("drug");
  const [showPatient, setShowPatient] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ItemRef[]>(getFavorites);
  const [history, setHistory] = useState<ItemRef[]>(getHistory);
  const [swStatus, setSwStatus] = useState<SwStatus>(getSwStatus);

  useEffect(() => subscribeSwStatus(setSwStatus), []);

  const drugResults = useMemo(
    () => (target === "drug" && query ? searchDrugs(query) : []),
    [target, query],
  );
  const organismResults = useMemo(
    () => (target === "organism" && query ? searchOrganisms(query) : []),
    [target, query],
  );

  if (!mode) return <ModeGate onPick={setMode} />;

  const go = (v: View) => {
    setView(v);
    setNotice(null);
    if (v.type === "drug") setHistory(pushHistory({ kind: "drug", id: v.id }));
    if (v.type === "organism") setHistory(pushHistory({ kind: "organism", id: v.id }));
    window.scrollTo({ top: 0 });
  };

  const currentItem: ItemRef | null =
    view.type === "drug"
      ? { kind: "drug", id: view.id }
      : view.type === "organism"
        ? { kind: "organism", id: view.id }
        : null;

  const isFav = (item: ItemRef) =>
    favorites.some((f) => f.kind === item.kind && f.id === item.id);

  const labelOf = (item: ItemRef) =>
    item.kind === "drug"
      ? DRUG_BY_ID.get(item.id)?.genericName.ja
      : ORGANISM_BY_ID.get(item.id)?.japaneseName;

  const itemList = (items: ItemRef[]) =>
    items
      .filter((i) => labelOf(i) != null)
      .map((i) => (
        <button
          key={`${i.kind}-${i.id}`}
          className="tab"
          onClick={() => go(i.kind === "drug" ? { type: "drug", id: i.id } : { type: "organism", id: i.id })}
        >
          {labelOf(i)}
        </button>
      ));

  const switchMode = () => {
    const next: PatientMode = mode === "adult" ? "pediatric" : "adult";
    setMode(next);
    setNotice(`${MODE_LABEL[next]}モードに切り替わりました`);
    window.scrollTo({ top: 0 });
  };

  const browse = target === "drug" && !query ? DRUGS.slice(0, 12) : [];

  return (
    <>
      <header className={`topbar mode-${mode}`}>
        <button
          className="brand link-btn"
          style={{ textDecoration: "none" }}
          onClick={() => {
            setQuery("");
            go({ type: "home" });
          }}
        >
          抗菌薬投与ナビ
        </button>
        <span className={`mode-badge ${mode}`}>{MODE_LABEL[mode]}</span>
        <span className="spacer" />
        <button className="link-btn" onClick={switchMode}>
          {MODE_LABEL[mode === "adult" ? "pediatric" : "adult"]}に切替
        </button>
        <button className="link-btn" onClick={() => setShowPatient((v) => !v)}>
          患者条件{showPatient ? "を閉じる" : ""}
        </button>
      </header>

      <main className="wrap">
        {swStatus === "update-available" && (
          <div className="banner warn">
            <b>新しいデータ版が利用できます。</b>
            表示中の内容は古い可能性があります。
            <button className="link-btn" onClick={() => void applyUpdate()}>
              今すぐ更新する
            </button>
          </div>
        )}
        {notice && <div className="banner info">{notice}</div>}

        {showPatient && (
          <div style={{ marginBottom: 18 }}>
            <PatientPanel mode={mode} patient={patient} onChange={setPatient} />
          </div>
        )}

        {view.type !== "home" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button className="back" onClick={() => setView({ type: "home" })}>
              ← ホーム
            </button>
            {currentItem && (
              <button
                className="tab"
                aria-pressed={isFav(currentItem)}
                onClick={() => setFavorites(toggleFavorite(currentItem))}
              >
                {isFav(currentItem) ? "★ お気に入り登録済み" : "☆ お気に入りに追加"}
              </button>
            )}
          </div>
        )}

        {view.type === "home" && (
          <>
            <div className="tabs">
              <button className="tab" aria-pressed={target === "drug"} onClick={() => setTarget("drug")}>
                薬剤で探す
              </button>
              <button className="tab" aria-pressed={target === "organism"} onClick={() => setTarget("organism")}>
                菌で探す
              </button>
            </div>

            <div className="searchbox">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  target === "drug"
                    ? "一般名・商品名・略語・カナで検索（例：セフェピム、CFPM、タゾピペ）"
                    : "学名・日本語名・略号で検索（例：緑膿菌、E.coli、MRSA、腸球菌）"
                }
                aria-label={target === "drug" ? "抗菌薬を検索" : "菌名を検索"}
              />
            </div>

            {!query && favorites.length > 0 && (
              <section className="section" style={{ marginTop: 0 }}>
                <h3>お気に入り</h3>
                <div className="tabs">{itemList(favorites)}</div>
              </section>
            )}

            {!query && history.length > 0 && (
              <section className="section" style={{ marginTop: favorites.length > 0 ? 20 : 0 }}>
                <h3>最近見たもの</h3>
                <div className="tabs">{itemList(history)}</div>
                <button
                  className="link-btn"
                  onClick={() => {
                    clearHistory();
                    setHistory([]);
                  }}
                >
                  履歴を消す
                </button>
              </section>
            )}

            {target === "drug" && (
              <div className="list">
                {(query ? drugResults : browse).map((d) => (
                  <DrugCard
                    key={d.id}
                    drug={d}
                    mode={mode}
                    patient={patient}
                    onOpen={() => go({ type: "drug", id: d.id })}
                  />
                ))}
                {query && drugResults.length === 0 && (
                  <>
                    <p className="empty">「{query}」に一致する薬剤はありません。</p>
                    {drugSuggestions(query).length > 0 && (
                      <>
                        <p className="dose-note">もしかして：</p>
                        {drugSuggestions(query).map((d) => (
                          <DrugCard
                            key={d.id}
                            drug={d}
                            mode={mode}
                            patient={patient}
                            onOpen={() => go({ type: "drug", id: d.id })}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {target === "organism" && (
              <div className="list">
                {organismResults.map((o) => (
                  <button
                    key={o.id}
                    className="result"
                    onClick={() => go({ type: "organism", id: o.id })}
                  >
                    <div className="result-head">
                      <span className="result-name">{o.japaneseName}</span>
                      <span className="result-sub">{o.scientificName}</span>
                    </div>
                    <div className="result-dose">{o.group}</div>
                  </button>
                ))}
                {query && organismResults.length === 0 && (
                  <p className="empty">「{query}」に一致する菌はありません。</p>
                )}
                {!query && (
                  <p className="empty">
                    学名（Escherichia coli）、日本語名（大腸菌）、略号（MRSA・GBS）、通称（緑膿菌）
                    のいずれでも検索できます。
                  </p>
                )}
              </div>
            )}

            <section className="section">
              <h3>その他の機能</h3>
              <div className="tile-grid">
                <button className="tile" onClick={() => go({ type: "offlabel" })}>
                  <b>適応外使用</b>
                  <span>薬剤名・疾患名の双方から検索</span>
                </button>
                {Object.entries(DESIGNERS).map(([key, d]) => (
                  <button key={key} className="tile" onClick={() => go({ type: "designer", key })}>
                    <b>{d.title}</b>
                    <span>患者条件から初期投与量を算出</span>
                  </button>
                ))}
                {PAGES.map((p) => (
                  <button key={p.key} className="tile" onClick={() => go({ type: "page", key: p.key })}>
                    <b>{p.title}</b>
                    <span>{p.sub}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {view.type === "drug" &&
          (() => {
            const drug = DRUG_BY_ID.get(view.id);
            if (!drug) return <p className="empty">薬剤が見つかりません。</p>;
            return (
              <DrugDetail
                drug={drug}
                mode={mode}
                patient={patient}
                onOpenDesigner={(key) => go({ type: "designer", key })}
                onOpenPage={(key) => go({ type: "page", key: key as PageKey })}
                onSwitchMode={switchMode}
              />
            );
          })()}

        {view.type === "organism" &&
          (() => {
            const organism = ORGANISM_BY_ID.get(view.id);
            if (!organism) return <p className="empty">菌が見つかりません。</p>;
            return <OrganismDetail organism={organism} />;
          })()}

        {view.type === "offlabel" && (
          <OffLabelSearch onOpenDrug={(id) => go({ type: "drug", id })} />
        )}

        {view.type === "designer" && <Designer designerKey={view.key} patient={patient} />}

        {view.type === "page" && view.key === "prophylaxis" && (
          <SurgicalProphylaxis patient={patient} onOpenDrug={(id) => go({ type: "drug", id })} />
        )}
        {view.type === "page" && view.key === "formulary" && (
          <Formulary onOpenDrug={(id) => go({ type: "drug", id })} />
        )}
        {view.type === "page" && view.key === "anaphylaxis" && <Anaphylaxis />}
        {view.type === "page" && view.key === "postexposure" && <PostExposureProphylaxis />}
        {view.type === "page" && view.key === "pediatric-weight" && <PediatricWeight />}
        {view.type === "page" && view.key === "pcg" && <PcgContinuousInfusion />}
        {view.type === "page" && view.key === "stewardship" && <Stewardship />}
        {view.type === "page" && view.key === "amr" && <Amr />}

        <footer className="foot">
          データ版：{MANUAL_EDITION.title} {MANUAL_EDITION.label}（{MANUAL_EDITION.issuedOn} ／{" "}
          {MANUAL_EDITION.facility} {MANUAL_EDITION.author}）
          <br />
          {swStatus === "ready" && <>オフライン利用可（端末に保存済み）<br /></>}
          本アプリが示す投与量は当院でコンセンサスの得られた標準的な投与量であり、最終的な投与判断は主治医が行います。
          使用時は添付文書を改めて精読し、必要に応じて感染症科・ICT／ASTへコンサルテーションしてください。
        </footer>
      </main>
    </>
  );
}
