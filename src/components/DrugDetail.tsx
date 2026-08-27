import type { Drug, PatientState, PatientMode, Route, Dose, RenalBand } from "../types";
import { RENAL_BAND_LABEL, OFFLABEL_CATEGORY_LABEL } from "../types";
import { convertPerKg, resolveRenalBand } from "../lib/calc";
import { offLabelForDrug } from "../lib/search";
import { DISEASE_BY_ID } from "../data";

const ROUTE_LABEL: Record<Route, string> = {
  iv: "注射",
  po: "経口",
  im: "筋注",
  inhalation: "吸入",
};

const BAND_ORDER: RenalBand[] = ["gt50", "ccr10_50", "lt10", "hd", "chdf"];

/** 薬剤詳細から参照させたい専用ページ */
const RELATED_PAGES: Record<string, { key: string; label: string; sub: string }> = {
  benzylpenicillin: {
    key: "pcg",
    label: "ペニシリンG持続静注の投与方法 →",
    sub: "1日総量と投与経路から調製手順・K濃度を確認できます（原典 p.28-29）",
  },
};

type Props = {
  drug: Drug;
  mode: PatientMode;
  patient: PatientState;
  onOpenDesigner: (key: string) => void;
  onOpenPage: (key: string) => void;
  onSwitchMode: () => void;
};

function DoseRow({
  dose,
  patient,
  mode,
}: {
  dose: Dose;
  patient: PatientState;
  mode: PatientMode;
}) {
  const conv = dose.perKg ? convertPerKg(dose.perKg, patient) : null;
  const showPerKgOnly = mode === "pediatric" && patient.weight == null;

  return (
    <div className="dose-row">
      {dose.indication && <div className="dose-ind">{dose.indication}</div>}
      <div className="dose-text">
        {dose.text}
        {dose.offLabel && (
          <>
            {" "}
            <span className="badge offlabel">適応外</span>
          </>
        )}
      </div>
      {conv && !showPerKgOnly && (
        // 小児は体重から換算した1日投与量が主役になるため大きく出す
        <div className={`dose-conv mono${mode === "pediatric" ? " strong" : ""}`}>
          → {conv.text}
          <span style={{ opacity: 0.75 }}>（{conv.basisLabel}）</span>
          {conv.clipped && <b>　※上限でクリップ</b>}
        </div>
      )}
      {conv && !showPerKgOnly && conv.uncappedNote && (
        <div className="dose-note">
          <b>{conv.uncappedNote}</b>（1日量からの自動計算には反映されていません）
        </div>
      )}
      {showPerKgOnly && dose.perKg && (
        <div className="dose-note">体重を入力すると1日投与量（mg）に換算します。</div>
      )}
      {dose.note && <div className="dose-note">{dose.note}</div>}
    </div>
  );
}

export function DrugDetail({
  drug,
  mode,
  patient,
  onOpenDesigner,
  onOpenPage,
  onSwitchMode,
}: Props) {
  const relatedPage = RELATED_PAGES[drug.id];
  const dosing = mode === "adult" ? drug.adult : drug.pediatric;
  const otherModeLabel = mode === "adult" ? "小児" : "成人";
  const hasOtherMode = !!(mode === "adult" ? drug.pediatric : drug.adult);
  const activeBand = resolveRenalBand(patient);
  const offLabel = offLabelForDrug(drug.id);

  return (
    <div>
      <div className="detail-head">
        <h2>{drug.genericName.ja}</h2>
        <p className="en">
          {drug.genericName.en}
          {drug.abbr && ` ／ ${drug.abbr}`} ／ {drug.class}
        </p>
        <div className="badges">
          {drug.requiresApplication && <span className="badge app">使用申請書が必要</span>}
          {drug.consultSpecialist && <span className="badge consult">専門家にコンサルテーション</span>}
          {drug.renalAdjustmentNotRequired && (
            <span className="badge renal-ok">腎機能低下時も常用量可</span>
          )}
          {/* TDM対象の薬剤はバッジ自体から投与設計へ飛べるようにする（スクロール不要） */}
          {drug.tdm &&
            (drug.tdm.designer ? (
              <button
                className="badge tdm badge-link"
                onClick={() => onOpenDesigner(drug.tdm!.designer!)}
              >
                TDM対象 — 初回投与量と採血タイミングを見る →
              </button>
            ) : (
              <span className="badge tdm">TDM対象</span>
            ))}
          {drug.aware && <span className="badge aware">AWaRe: {drug.aware}</span>}
        </div>
      </div>

      {drug.requiresApplication && (
        <div className="banner warn">
          <b>使用申請書が必要な抗菌薬です。</b>
          該当する患者に初めて使用する場合は「抗菌薬使用申請書」に使用目的を電子カルテ上に記録すること（原典 p.7-8）。
        </div>
      )}
      {drug.consultSpecialist && (
        <div className="banner danger">
          <b>使用にあたり専門家へのコンサルテーションが必要です。</b>
          感染症科及びICT・ASTによる適正使用評価の対象です（原典 p.11, 23-27）。
        </div>
      )}

      {/* ---- 通常量 ---- */}
      <section className="section">
        <h3>通常量（{mode === "adult" ? "成人" : "小児"}）</h3>
        {dosing && Object.keys(dosing).length > 0 ? (
          (Object.keys(dosing) as Route[]).map((route) => (
            <div key={route} style={{ marginBottom: 14 }}>
              <div className="dose-ind" style={{ color: "var(--accent)" }}>
                {ROUTE_LABEL[route]}
              </div>
              {dosing[route]!.map((d, i) => (
                <DoseRow key={i} dose={d} patient={patient} mode={mode} />
              ))}
            </div>
          ))
        ) : (
          <p className="empty">
            {mode === "pediatric"
              ? "原典に小児の用量記載がありません。"
              : "原典に成人の用量記載がありません。"}
          </p>
        )}
        {hasOtherMode && (
          <button className="link-btn" onClick={onSwitchMode}>
            {otherModeLabel}用量を見る →（このレーンの表示が{otherModeLabel}に切り替わります）
          </button>
        )}
        {relatedPage && (
          <button className="tile" style={{ marginTop: 12 }} onClick={() => onOpenPage(relatedPage.key)}>
            <b>{relatedPage.label}</b>
            <span>{relatedPage.sub}</span>
          </button>
        )}
      </section>

      {/* ---- 腎機能（原典の腎機能低下時の表は成人向けのため、小児では表示しない） ---- */}
      {mode === "pediatric" && (drug.renal || drug.renalPo) && (
        <section className="section">
          <h3>腎機能低下時・透析・CHDF</h3>
          <p className="empty" style={{ padding: "12px 0" }}>
            原典の腎機能低下時の投与量表は成人を対象としています。
            小児の腎機能低下例については薬剤部・小児科に相談してください。
          </p>
        </section>
      )}

      {mode === "adult" && (drug.renal || drug.renalPo || drug.renalNote) && (
        <section className="section">
          <h3>腎機能低下時・透析・CHDF</h3>
          {drug.renalAdjustmentNotRequired && (
            <div className="banner info">
              原典★印：<b>腎機能低下時も常用量投与が可能な薬剤</b>です。
            </div>
          )}
          {activeBand == null && (
            <p className="dose-note" style={{ marginBottom: 8 }}>
              患者条件（年齢・性別・体重・Cr）を入力すると、該当する区分を自動でハイライトします。
            </p>
          )}

          {drug.renal && (
            <>
              <div className="dose-ind" style={{ color: "var(--accent)" }}>注射</div>
              <div className="renal-grid" style={{ marginBottom: 14 }}>
                {BAND_ORDER.filter((b) => drug.renal![b]).map((band) => (
                  <div
                    key={band}
                    className={
                      "renal-row " +
                      (activeBand == null ? "" : activeBand === band ? "active" : "dim")
                    }
                  >
                    <div className="band">{RENAL_BAND_LABEL[band]}</div>
                    <div>{drug.renal![band]}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {drug.renalPo && (
            <>
              <div className="dose-ind" style={{ color: "var(--accent)" }}>経口</div>
              <div className="renal-grid" style={{ marginBottom: 14 }}>
                {BAND_ORDER.filter((b) => drug.renalPo![b]).map((band) => (
                  <div
                    key={band}
                    className={
                      "renal-row " +
                      (activeBand == null ? "" : activeBand === band ? "active" : "dim")
                    }
                  >
                    <div className="band">{RENAL_BAND_LABEL[band]}</div>
                    <div>{drug.renalPo![band]}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeBand && !drug.renal?.[activeBand] && !drug.renalPo?.[activeBand] && (
            <div className="banner warn">
              この患者の腎機能区分（{RENAL_BAND_LABEL[activeBand]}）について、
              <b>原典に記載がありません</b>。専門家へ相談してください。
            </div>
          )}

          {drug.renalNote && <ul className="notes"><li>{drug.renalNote}</li></ul>}
        </section>
      )}

      {/* ---- TDM ---- */}
      {drug.tdm && (
        <section className="section">
          <h3>TDM</h3>
          <dl className="kv">
            {drug.tdm.targets.map((t, i) => (
              <div key={i} style={{ display: "contents" }}>
                <dt>
                  {t.type === "trough" ? "トラフ" : t.type === "peak" ? "ピーク" : "AUC"}
                  {t.condition ? `（${t.condition}）` : ""}
                </dt>
                <dd className="mono">
                  {t.value} {t.unit}
                </dd>
              </div>
            ))}
            {drug.tdm.sampling.trough && (
              <>
                <dt>採血（トラフ）</dt>
                <dd>{drug.tdm.sampling.trough}</dd>
              </>
            )}
            {drug.tdm.sampling.peak && (
              <>
                <dt>採血（ピーク）</dt>
                <dd>{drug.tdm.sampling.peak}</dd>
              </>
            )}
            {drug.tdm.firstTdmDose && (
              <>
                <dt>実施時期</dt>
                <dd>{drug.tdm.firstTdmDose}</dd>
              </>
            )}
            {drug.tdm.loadingDose && (
              <>
                <dt>ローディング</dt>
                <dd>{drug.tdm.loadingDose}</dd>
              </>
            )}
          </dl>
          {drug.tdm.cautions && (
            <ul className="notes">
              {drug.tdm.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          {drug.tdm.designer && (
            <button
              className="tile"
              style={{ marginTop: 12 }}
              onClick={() => onOpenDesigner(drug.tdm!.designer!)}
            >
              <b>投与設計ツールを開く →</b>
              <span>初回投与量・採血のタイミング・目標血中濃度を確認できます</span>
            </button>
          )}
          <p className="source-line">原典 p.{drug.tdm.source.pages.join(", ")}</p>
        </section>
      )}

      {/* ---- 適応外使用 ---- */}
      {offLabel.length > 0 && (
        <section className="section">
          <h3>適応外使用（院内承認済み）</h3>
          <div className="banner danger">
            適応外使用は薬機法上、<b>患者への十分な説明と文書での同意</b>が必要です。
            「適応症及び用法・用量に関する使用」「用法・用量に関する使用」は
            <b>重症例での使用に限り検討</b>し、通常の感染症治療では適応範囲内で治療すること（原典 p.52）。
          </div>
          {offLabel.map((use) => (
            <div className="dose-row" key={use.id}>
              <div className="dose-ind">{OFFLABEL_CATEGORY_LABEL[use.category]}</div>
              <div className="dose-text">
                {use.diseaseIds
                  .map((id) => DISEASE_BY_ID.get(id)?.name ?? id)
                  .join("、")}
              </div>
              {use.dosageText && <div className="dose-conv">{use.dosageText}</div>}
              <div className="dose-note">
                {use.productLabel}　／　原典 p.{use.source.pages.join(", ")}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ---- 製剤情報 ---- */}
      {drug.formulations && drug.formulations.length > 0 && (
        <section className="section">
          <h3>製剤情報</h3>
          <button className="tile" style={{ marginBottom: 12 }} onClick={() => onOpenPage("formulary")}>
            <b>当院採用注射抗菌薬一覧 →</b>
            <span>他剤も含めた規格・薬価・投与時間・配合変化の一覧</span>
          </button>
          {drug.formulations.map((f, i) => (
            <div className="dose-row" key={i}>
              <div className="dose-text">
                <b>{f.brandName}</b>
              </div>
              <dl className="kv" style={{ marginTop: 4 }}>
                <dt>規格</dt>
                <dd>{f.strength}</dd>
                {f.price != null && (
                  <>
                    <dt>薬価</dt>
                    <dd className="mono">{f.price.toLocaleString()} 円</dd>
                  </>
                )}
                <dt>投与</dt>
                <dd>
                  静注 {f.ivPush ? "可" : "×"} ／ 点滴{" "}
                  {f.drip === false ? "×" : f.drip} ／ 筋注 {f.im ? "可" : "×"}
                </dd>
                {f.incompatibleWith && f.incompatibleWith.length > 0 && (
                  <>
                    <dt>配合変化</dt>
                    <dd>{f.incompatibleWith.join("、")}</dd>
                  </>
                )}
              </dl>
              {f.notes && (
                <ul className="notes">
                  {f.notes.map((n, j) => (
                    <li key={j}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      <p className="source-line">
        出典：抗菌薬投与マニュアル 第9版 p.{drug.source.pages.join(", ")}
      </p>
    </div>
  );
}
