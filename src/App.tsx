import { useEffect, useState } from "react";
import type { PatientMode, PatientState } from "./types";
import { DRUG_BY_ID, ORGANISM_BY_ID, MANUAL_EDITION } from "./data";
import { searchOrganisms } from "./lib/search";
import { LANE_LABEL, type AwareBucket, type DrugLane } from "./lib/lanes";
import { PatientPanel, emptyPatient } from "./components/PatientPanel";
import { DrugDetail } from "./components/DrugDetail";
import { DrugList, LanePicker, ModePicker } from "./components/DrugLane";
import {
  Opening,
  OtherMenu,
  APP_TITLE,
  APP_EDITION,
  type OtherKey,
  type TopCategory,
} from "./components/Opening";
import { OrganismDetail } from "./components/OrganismDetail";
import { OffLabelSearch } from "./components/OffLabelSearch";
import { Designer } from "./components/Designer";
import { SurgicalProphylaxis } from "./components/SurgicalProphylaxis";
import { Formulary } from "./components/Formulary";
import {
  PostExposureProphylaxis,
  PediatricWeight,
  PcgContinuousInfusion,
  Stewardship,
  Amr,
} from "./components/Reference";
import { About, DisclaimerGate } from "./components/About";
import {
  getFavorites,
  getHistory,
  toggleFavorite,
  pushHistory,
  hasAcknowledgedDisclaimer,
  acknowledgeDisclaimer,
  type ItemRef,
} from "./lib/storage";
import { subscribeSwStatus, getSwStatus, applyUpdate, type SwStatus } from "./lib/sw";

type PageKey =
  | "prophylaxis"
  | "formulary"
  | "postexposure"
  | "pediatric-weight"
  | "pcg"
  | "stewardship"
  | "amr"
  | "offlabel";

type View =
  | { type: "opening" }
  | { type: "other" }
  /** 内服薬・注射薬を選んだ直後の 成人／小児 */
  | { type: "mode"; lane: DrugLane }
  /** 薬剤名の入力欄と分類ボタン */
  | { type: "picker"; lane: DrugLane }
  /** 分類を選んだ後の薬剤一覧 */
  | { type: "drugs"; lane: DrugLane; bucket?: AwareBucket; drugClass?: string }
  | { type: "organisms" }
  | { type: "drug"; id: string }
  | { type: "organism"; id: string }
  | { type: "designer"; key: string; fromDrugId?: string }
  | { type: "about" }
  | { type: "page"; key: PageKey };

const MODE_LABEL: Record<PatientMode, string> = { adult: "成人", pediatric: "小児" };

export default function App() {
  const [patient, setPatient] = useState<PatientState>(emptyPatient);
  const [view, setView] = useState<View>({ type: "opening" });
  const [mode, setMode] = useState<PatientMode | null>(null);
  const [organismQuery, setOrganismQuery] = useState("");
  const [showPatient, setShowPatient] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ItemRef[]>(getFavorites);
  const [, setHistory] = useState<ItemRef[]>(getHistory);
  const [swStatus, setSwStatus] = useState<SwStatus>(getSwStatus);
  const [agreed, setAgreed] = useState(hasAcknowledgedDisclaimer);

  useEffect(() => subscribeSwStatus(setSwStatus), []);

  // 免責事項を読ませないまま使わせない（初回のみ）
  if (!agreed) {
    return (
      <DisclaimerGate
        onAgree={() => {
          acknowledgeDisclaimer();
          setAgreed(true);
        }}
      />
    );
  }

  const go = (v: View) => {
    setView(v);
    setNotice(null);
    if (v.type === "drug") setHistory(pushHistory({ kind: "drug", id: v.id }));
    if (v.type === "organism") setHistory(pushHistory({ kind: "organism", id: v.id }));
    window.scrollTo({ top: 0 });
  };

  const openTop = (key: TopCategory) => {
    if (key === "organism") {
      setOrganismQuery("");
      go({ type: "organisms" });
    } else if (key === "other") {
      go({ type: "other" });
    } else {
      // 集団が選択済みなら分類選択へ直行する
      go(mode ? { type: "picker", lane: key } : { type: "mode", lane: key });
    }
  };

  const openOther = (key: OtherKey) => go({ type: "page", key: key as PageKey });

  const pickMode = (lane: DrugLane, m: PatientMode) => {
    setMode(m);
    go({ type: "picker", lane });
  };

  /** 薬剤レーン内でのみ集団を切り替える */
  const switchMode = () => {
    if (!mode) return;
    const next: PatientMode = mode === "adult" ? "pediatric" : "adult";
    setMode(next);
    setNotice(`${MODE_LABEL[next]}の用量に切り替わりました。`);
    window.scrollTo({ top: 0 });
  };

  const goHome = () => {
    setOrganismQuery("");
    go({ type: "opening" });
  };

  const openPage = (key: string) => go({ type: "page", key: key as PageKey });

  /** その画面が薬剤レーンの中か（集団バッジを出すか） */
  const laneOf = (): DrugLane | null => {
    if (view.type === "picker" || view.type === "drugs") return view.lane;
    if (view.type === "drug") {
      const d = DRUG_BY_ID.get(view.id);
      if (!d) return null;
      return d.adult?.po || d.pediatric?.po ? "oral" : "injectable";
    }
    if (view.type === "designer") return "injectable";
    return null;
  };
  const lane = laneOf();
  const showModeBadge = mode != null && lane != null;

  const currentItem: ItemRef | null =
    view.type === "drug"
      ? { kind: "drug", id: view.id }
      : view.type === "organism"
        ? { kind: "organism", id: view.id }
        : null;
  const isFav = (item: ItemRef) => favorites.some((f) => f.kind === item.kind && f.id === item.id);

  /* ---------------- オープニングは単独画面 ---------------- */
  if (view.type === "opening") {
    return (
      <>
        <header className="topbar minimal">
          <span className="spacer" />
          <button className="link-btn" onClick={() => go({ type: "about" })}>
            アプリの説明
          </button>
        </header>
        {swStatus === "update-available" && (
          <div className="wrap" style={{ paddingBottom: 0 }}>
            <div className="banner warn">
              <b>新しいデータ版が利用できます。</b>
              <button className="link-btn" onClick={() => void applyUpdate()}>
                今すぐ更新する
              </button>
            </div>
          </div>
        )}
        <Opening onPick={openTop} />
        <footer className="foot opening-foot">
          {MANUAL_EDITION.facility}の院内利用を想定したアプリです。
          最終的な投与判断は主治医が行います。
          <button className="link-btn" onClick={() => go({ type: "about" })}>
            免責事項 →
          </button>
        </footer>
      </>
    );
  }

  return (
    <>
      <header className={`topbar${showModeBadge ? ` mode-${mode}` : ""}`}>
        <button className="brand link-btn" style={{ textDecoration: "none" }} onClick={goHome}>
          {APP_TITLE}
        </button>
        {showModeBadge && (
          <span className={`mode-badge ${mode}`}>
            {LANE_LABEL[lane!]}／{MODE_LABEL[mode!]}
          </span>
        )}
        <span className="spacer" />
        {showModeBadge && (
          <button className="link-btn" onClick={switchMode}>
            {MODE_LABEL[mode === "adult" ? "pediatric" : "adult"]}に切替
          </button>
        )}
        <button className="link-btn" onClick={() => setShowPatient((v) => !v)}>
          患者条件{showPatient ? "を閉じる" : ""}
        </button>
        <button className="link-btn" onClick={() => go({ type: "about" })}>
          アプリの説明
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
            <PatientPanel mode={mode ?? "adult"} patient={patient} onChange={setPatient} />
          </div>
        )}

        <div className="crumbs">
          <button className="back" onClick={goHome}>
            ← トップ
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

        {/* ---------------- その他 ---------------- */}
        {view.type === "other" && (
          <>
            <div className="detail-head">
              <h2>その他</h2>
            </div>
            <OtherMenu onPick={openOther} />
          </>
        )}

        {/* ---------------- 成人／小児 ---------------- */}
        {view.type === "mode" && (
          <>
            <div className="detail-head">
              <h2>{LANE_LABEL[view.lane]}</h2>
            </div>
            <ModePicker onPick={(m) => pickMode(view.lane, m)} />
          </>
        )}

        {/* ---------------- 薬剤名入力＋分類 ---------------- */}
        {view.type === "picker" && mode && (
          <LanePicker
            lane={view.lane}
            mode={mode}
            patient={patient}
            onOpenDrug={(id) => go({ type: "drug", id })}
            onPickBucket={(bucket) => go({ type: "drugs", lane: view.lane, bucket })}
            onPickClass={(drugClass) => go({ type: "drugs", lane: view.lane, drugClass })}
            onOpenPage={openPage}
          />
        )}

        {/* ---------------- 薬剤一覧 ---------------- */}
        {view.type === "drugs" && mode && (
          <>
            <div className="detail-head">
              <h2>{view.bucket ?? view.drugClass}</h2>
            </div>
            <button className="back" onClick={() => go({ type: "picker", lane: view.lane })}>
              ← 分類の選択に戻る
            </button>
            <DrugList
              lane={view.lane}
              mode={mode}
              patient={patient}
              bucket={view.bucket}
              drugClass={view.drugClass}
              onOpenDrug={(id) => go({ type: "drug", id })}
            />
          </>
        )}

        {/* ---------------- 菌種別 ---------------- */}
        {view.type === "organisms" && (
          <>
            <div className="detail-head">
              <h2>菌種別</h2>
            </div>
            <div className="searchbox">
              <input
                value={organismQuery}
                onChange={(e) => setOrganismQuery(e.target.value)}
                placeholder="菌名を入力（学名・日本語名・略号）"
                aria-label="菌名を入力"
              />
            </div>
            <div className="list">
              {searchOrganisms(organismQuery).map((o) => (
                <button
                  key={o.id}
                  className="result"
                  onClick={() => go({ type: "organism", id: o.id })}
                >
                  <div className="result-head">
                    <span className="result-name">{o.japaneseName}</span>
                    <span className="result-sub">{o.scientificName}</span>
                  </div>
                </button>
              ))}
              {organismQuery && searchOrganisms(organismQuery).length === 0 && (
                <p className="empty">「{organismQuery}」に一致する菌はありません。</p>
              )}
              {!organismQuery && (
                <p className="empty">
                  学名（Escherichia coli）、日本語名（大腸菌）、略号（MRSA・GBS）、
                  通称（緑膿菌）のいずれでも検索できます。
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
                mode={mode ?? "adult"}
                patient={patient}
                onOpenDesigner={(key) => go({ type: "designer", key, fromDrugId: drug.id })}
                onOpenPage={openPage}
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

        {view.type === "designer" && (
          <>
            {mode === "pediatric" && (
              <div className="banner warn">
                <b>この投与設計の表は成人を対象としています。</b>
                小児のTDMは薬剤部（TDM担当者）に相談してください。
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

        {view.type === "about" && (
          <About swStatus={swStatus} onApplyUpdate={() => void applyUpdate()} />
        )}

        {view.type === "page" && view.key === "prophylaxis" && (
          <SurgicalProphylaxis patient={patient} onOpenDrug={(id) => go({ type: "drug", id })} />
        )}
        {view.type === "page" && view.key === "formulary" && (
          <Formulary onOpenDrug={(id) => go({ type: "drug", id })} />
        )}
        {view.type === "page" && view.key === "offlabel" && (
          <OffLabelSearch onOpenDrug={(id) => go({ type: "drug", id })} />
        )}
        {view.type === "page" && view.key === "postexposure" && <PostExposureProphylaxis />}
        {view.type === "page" && view.key === "pediatric-weight" && <PediatricWeight />}
        {view.type === "page" && view.key === "pcg" && <PcgContinuousInfusion />}
        {view.type === "page" && view.key === "stewardship" && <Stewardship />}
        {view.type === "page" && view.key === "amr" && <Amr />}

        <footer className="foot">
          データ版：{APP_TITLE} {APP_EDITION}（{MANUAL_EDITION.issuedOn} ／{" "}
          {MANUAL_EDITION.facility} {MANUAL_EDITION.author}）
          <br />
          {swStatus === "ready" && (
            <>
              オフライン利用可（端末に保存済み）
              <br />
            </>
          )}
          <b>{MANUAL_EDITION.facility}の院内利用を想定したアプリです。</b>
          適応外使用・採用薬・使用申請のルール・アンチバイオグラムは当院の取り決めまたは当院のデータであり、
          他施設ではそのまま当てはまりません。
          示される投与量は当院でコンセンサスの得られた標準的な投与量であり、最終的な投与判断は主治医が行います。
          使用時は添付文書を改めて精読してください。入力した患者条件は端末内にのみ保持され、外部に送信されません。
          <br />
          <button className="link-btn" onClick={() => go({ type: "about" })}>
            アプリの説明・免責事項の全文 →
          </button>
        </footer>
      </main>
    </>
  );
}
