import { useEffect, useMemo, useState } from "react";
import type { PatientMode, PatientState } from "./types";
import { DRUG_BY_ID, ORGANISM_BY_ID, MANUAL_EDITION } from "./data";
import { searchOrganisms } from "./lib/search";
import { LANE_LABEL, type DrugLane } from "./lib/lanes";
import { PatientPanel, emptyPatient } from "./components/PatientPanel";
import { DrugDetail } from "./components/DrugDetail";
import { DrugLaneView, ModePicker } from "./components/DrugLane";
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

/* ---------------- 画面の種類 ---------------- */

type View =
  | { type: "home" }
  | { type: "lane"; lane: DrugLane }
  | { type: "organisms" }
  | { type: "drug"; id: string }
  | { type: "organism"; id: string }
  | { type: "offlabel" }
  | { type: "designer"; key: string; fromDrugId?: string }
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

/** 大項目4ボタン（UI再編 版2.0 §1.1）。原典の章立てに対応する */
const LANES: {
  key: "oral" | "injectable" | "organism" | "prophylaxis";
  title: string;
  sub: string;
}[] = [
  { key: "oral", title: "内服薬", sub: "成人・小児を選び、薬名またはAWaRe分類から探す" },
  { key: "injectable", title: "注射薬", sub: "成人・小児を選び、薬名または系統から探す" },
  { key: "organism", title: "菌名", sub: "菌名からアンチバイオグラム（感受性率）を引く" },
  { key: "prophylaxis", title: "周術期", sub: "術式の領域から予防抗菌薬・1回量・投与期間" },
];

/** ホーム下部の従属セクション */
const PAGES: { key: PageKey | "offlabel"; title: string; sub: string }[] = [
  { key: "offlabel", title: "適応外使用", sub: "薬剤名・疾患名の双方から検索" },
  { key: "pcg", title: "ペニシリンG持続静注", sub: "1日総量と経路から調製手順" },
  { key: "anaphylaxis", title: "アナフィラキシー対応", sub: "重症度別の救急処置" },
  { key: "postexposure", title: "曝露後予防投与", sub: "HBV・HIV・水痘・インフルエンザほか" },
  { key: "formulary", title: "当院採用注射抗菌薬一覧", sub: "規格・薬価・投与時間・配合変化" },
  { key: "pediatric-weight", title: "小児の体重・薬用量", sub: "年齢別体重、Augsberger式ほか" },
  { key: "stewardship", title: "適正使用指針・AWaRe", sub: "申請ルールとAWaRe分類" },
  { key: "amr", title: "AMR対策", sub: "抗微生物薬適正使用の手引き・参考文献" },
];

const MODE_LABEL: Record<PatientMode, string> = { adult: "成人", pediatric: "小児" };

/** その薬剤画面が属するレーン（詳細画面で表示する集団を決める） */
type LaneContext = { lane: DrugLane; mode: PatientMode } | null;

export default function App() {
  const [patient, setPatient] = useState<PatientState>(emptyPatient);
  const [view, setView] = useState<View>({ type: "home" });
  const [laneCtx, setLaneCtx] = useState<LaneContext>(null);
  /** 直前に選んだ集団。レーンに入り直したときの初期値として引き継ぐ */
  const [lastMode, setLastMode] = useState<PatientMode | null>(null);
  const [organismQuery, setOrganismQuery] = useState("");
  const [showPatient, setShowPatient] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ItemRef[]>(getFavorites);
  const [history, setHistory] = useState<ItemRef[]>(getHistory);
  const [swStatus, setSwStatus] = useState<SwStatus>(getSwStatus);

  useEffect(() => subscribeSwStatus(setSwStatus), []);

  const organismResults = useMemo(
    () => (organismQuery ? searchOrganisms(organismQuery) : []),
    [organismQuery],
  );

  const go = (v: View) => {
    setView(v);
    setNotice(null);
    if (v.type === "drug") setHistory(pushHistory({ kind: "drug", id: v.id }));
    if (v.type === "organism") setHistory(pushHistory({ kind: "organism", id: v.id }));
    window.scrollTo({ top: 0 });
  };

  /** 大項目を開く。薬剤レーンは集団が未選択なら選択画面を出す */
  const openLane = (key: (typeof LANES)[number]["key"]) => {
    if (key === "organism") {
      setLaneCtx(null);
      go({ type: "organisms" });
      return;
    }
    if (key === "prophylaxis") {
      setLaneCtx(null);
      go({ type: "page", key: "prophylaxis" });
      return;
    }
    const lane = key as DrugLane;
    setLaneCtx(lastMode ? { lane, mode: lastMode } : null);
    go({ type: "lane", lane });
  };

  const pickMode = (lane: DrugLane, mode: PatientMode) => {
    setLaneCtx({ lane, mode });
    setLastMode(mode);
    window.scrollTo({ top: 0 });
  };

  /** レーン内でのみ集団を切り替える。菌名・周術期には波及させない */
  const switchMode = () => {
    if (!laneCtx) return;
    const next: PatientMode = laneCtx.mode === "adult" ? "pediatric" : "adult";
    setLaneCtx({ ...laneCtx, mode: next });
    setLastMode(next);
    setNotice(
      `${LANE_LABEL[laneCtx.lane]}の${MODE_LABEL[next]}用量に切り替わりました。表示中の用量は${MODE_LABEL[next]}のものです。`,
    );
    window.scrollTo({ top: 0 });
  };

  const goHome = () => {
    setLaneCtx(null);
    setOrganismQuery("");
    go({ type: "home" });
  };

  const openPage = (key: string) =>
    key === "offlabel" ? go({ type: "offlabel" }) : go({ type: "page", key: key as PageKey });

  const currentItem: ItemRef | null =
    view.type === "drug"
      ? { kind: "drug", id: view.id }
      : view.type === "organism"
        ? { kind: "organism", id: view.id }
        : null;

  const isFav = (item: ItemRef) => favorites.some((f) => f.kind === item.kind && f.id === item.id);

  const labelOf = (item: ItemRef) =>
    item.kind === "drug"
      ? DRUG_BY_ID.get(item.id)?.genericName.ja
      : ORGANISM_BY_ID.get(item.id)?.japaneseName;

  /**
   * お気に入り・履歴から薬剤を開くとき、集団が未選択なら成人を初期値にする。
   * どの集団の用量を見ているかはヘッダーに常時表示されるため、取り違えは起きない。
   */
  const openSavedItem = (i: ItemRef) => {
    if (i.kind === "organism") {
      setLaneCtx(null);
      go({ type: "organism", id: i.id });
      return;
    }
    const drug = DRUG_BY_ID.get(i.id);
    const mode = laneCtx?.mode ?? lastMode ?? "adult";
    const lane: DrugLane =
      laneCtx?.lane ??
      (drug?.adult?.po || drug?.pediatric?.po ? "oral" : "injectable");
    setLaneCtx({ lane, mode });
    setLastMode(mode);
    go({ type: "drug", id: i.id });
  };

  const itemList = (items: ItemRef[]) =>
    items
      .filter((i) => labelOf(i) != null)
      .map((i) => (
        <button key={`${i.kind}-${i.id}`} className="tab" onClick={() => openSavedItem(i)}>
          {labelOf(i)}
        </button>
      ));

  /** 薬剤詳細・投与設計は、どの集団を見ているかをヘッダーに出す */
  const showModeBadge =
    laneCtx != null &&
    (view.type === "lane" || view.type === "drug" || view.type === "designer");

  return (
    <>
      <header className={`topbar${showModeBadge ? ` mode-${laneCtx!.mode}` : ""}`}>
        <button className="brand link-btn" style={{ textDecoration: "none" }} onClick={goHome}>
          抗菌薬投与ナビ
        </button>
        {showModeBadge && (
          <span className={`mode-badge ${laneCtx!.mode}`}>
            {LANE_LABEL[laneCtx!.lane]}／{MODE_LABEL[laneCtx!.mode]}
          </span>
        )}
        <span className="spacer" />
        {showModeBadge && (
          <button className="link-btn" onClick={switchMode}>
            {MODE_LABEL[laneCtx!.mode === "adult" ? "pediatric" : "adult"]}に切替
          </button>
        )}
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
            <PatientPanel
              mode={laneCtx?.mode ?? "adult"}
              patient={patient}
              onChange={setPatient}
            />
          </div>
        )}

        {view.type !== "home" && (
          <div className="crumbs">
            <button className="back" onClick={goHome}>
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

        {/* ---------------- ホーム ---------------- */}
        {view.type === "home" && (
          <>
            <section className="section" style={{ marginTop: 4 }}>
              <h3>何を調べますか？</h3>
              <div className="lane-grid">
                {LANES.map((l) => (
                  <button key={l.key} className="lane-tile" onClick={() => openLane(l.key)}>
                    <b>{l.title}</b>
                    <span>{l.sub}</span>
                  </button>
                ))}
              </div>
            </section>

            {favorites.length > 0 && (
              <section className="section">
                <h3>お気に入り</h3>
                <div className="tabs">{itemList(favorites)}</div>
              </section>
            )}

            {history.length > 0 && (
              <section className="section">
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

            <section className="section">
              <h3>その他の機能</h3>
              <div className="tile-grid">
                {Object.entries(DESIGNERS).map(([key, d]) => (
                  <button key={key} className="tile" onClick={() => go({ type: "designer", key })}>
                    <b>{d.title}</b>
                    <span>初回投与量と採血タイミングを確認できます</span>
                  </button>
                ))}
                {PAGES.map((p) => (
                  <button key={p.key} className="tile" onClick={() => openPage(p.key)}>
                    <b>{p.title}</b>
                    <span>{p.sub}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ---------------- 薬剤レーン ---------------- */}
        {view.type === "lane" &&
          (laneCtx == null || laneCtx.lane !== view.lane ? (
            <>
              <div className="detail-head">
                <h2>{LANE_LABEL[view.lane]}</h2>
              </div>
              <ModePicker lane={view.lane} onPick={(m) => pickMode(view.lane, m)} />
            </>
          ) : (
            <DrugLaneView
              lane={laneCtx.lane}
              mode={laneCtx.mode}
              patient={patient}
              onOpenDrug={(id) => go({ type: "drug", id })}
              onOpenPage={openPage}
            />
          ))}

        {/* ---------------- 菌名レーン（集団の選択なし） ---------------- */}
        {view.type === "organisms" && (
          <>
            <div className="detail-head">
              <h2>菌名から探す</h2>
              <p className="en">
                菌の感受性率は患者の年齢によらないため、成人・小児の選択はありません。
              </p>
            </div>
            <div className="searchbox">
              <input
                value={organismQuery}
                onChange={(e) => setOrganismQuery(e.target.value)}
                placeholder="学名・日本語名・略号で検索（例：緑膿菌、E.coli、MRSA、腸球菌）"
                aria-label="菌名を検索"
              />
            </div>
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
              {organismQuery && organismResults.length === 0 && (
                <p className="empty">「{organismQuery}」に一致する菌はありません。</p>
              )}
              {!organismQuery && (
                <p className="empty">
                  学名（Escherichia coli）、日本語名（大腸菌）、略号（MRSA・GBS）、通称（緑膿菌）
                  のいずれでも検索できます。
                </p>
              )}
            </div>
          </>
        )}

        {/* ---------------- 詳細・ツール ---------------- */}
        {view.type === "drug" &&
          (() => {
            const drug = DRUG_BY_ID.get(view.id);
            if (!drug) return <p className="empty">薬剤が見つかりません。</p>;
            return (
              <DrugDetail
                drug={drug}
                mode={laneCtx?.mode ?? "adult"}
                patient={patient}
                onOpenDesigner={(key) => go({ type: "designer", key, fromDrugId: drug.id })}
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

        {view.type === "offlabel" && <OffLabelSearch onOpenDrug={(id) => go({ type: "drug", id })} />}

        {view.type === "designer" && (
          <>
            {laneCtx?.mode === "pediatric" && (
              <div className="banner warn">
                <b>この投与設計の表は成人を対象としています。</b>
                小児への適用は原典の対象範囲外です。小児のTDMは薬剤部（TDM担当者）に相談してください。
              </div>
            )}
            <Designer
              designerKey={view.key}
              patient={patient}
              fromDrugId={view.fromDrugId}
              onOpenPatient={() => setShowPatient(true)}
              onOpenDrug={(id) => go({ type: "drug", id })}
            />
          </>
        )}

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
          {swStatus === "ready" && (
            <>
              オフライン利用可（端末に保存済み）
              <br />
            </>
          )}
          本アプリが示す投与量は当院でコンセンサスの得られた標準的な投与量であり、最終的な投与判断は主治医が行います。
          使用時は添付文書を改めて精読し、必要に応じて感染症科・ICT／ASTへコンサルテーションしてください。
          入力した患者条件は端末内にのみ保持され、外部に送信されません。
        </footer>
      </main>
    </>
  );
}
