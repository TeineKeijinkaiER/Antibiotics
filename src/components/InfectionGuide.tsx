import type { PatientMode } from "../types";
import {
  ACUTE_DIARRHEA,
  APPROPRIATE_USE_GUIDE,
  DIARRHEA_INCUBATION,
  HOSPITAL_ONSET,
} from "../data/infections";

export type InfectionGuideId = "acute-diarrhea" | "hospital-onset";

export function InfectionMenu({
  mode,
  onPick,
}: {
  mode: PatientMode;
  onPick: (id: InfectionGuideId) => void;
}) {
  return (
    <div>
      <div className="detail-head">
        <h2>感染症別</h2>
        <p className="en">{mode === "adult" ? "成人" : "小児"}</p>
      </div>
      <div className="top-grid">
        <button className="top-btn" onClick={() => onPick("acute-diarrhea")}>急性下痢症</button>
        <button className="top-btn" onClick={() => onPick("hospital-onset")}>院内発症感染症</button>
      </div>
    </div>
  );
}

function SourceLine({ volume, pages }: { volume: string; pages: readonly number[] }) {
  return (
    <p className="source-line">
      出典：{APPROPRIATE_USE_GUIDE.publisher}『{APPROPRIATE_USE_GUIDE.title}』{volume} p.{pages.join(", ")}
    </p>
  );
}

function AcuteDiarrhea({ mode }: { mode: PatientMode }) {
  const content = ACUTE_DIARRHEA[mode];
  return (
    <div>
      <div className="detail-head">
        <h2>{ACUTE_DIARRHEA.title}</h2>
        <p className="en">{mode === "adult" ? "成人" : "小児"} ／ 適正使用の手引きからの要約</p>
      </div>
      <div className="banner info"><b>{ACUTE_DIARRHEA.summary[mode]}</b></div>

      <section className="section">
        <h3>診断・鑑別</h3>
        <ul className="notes infection-notes">{content.assessment.map((v) => <li key={v}>{v}</li>)}</ul>
      </section>

      {mode === "adult" && (
        <section className="section">
          <h3>主な原因食品と潜伏期間</h3>
          <div className="scroll">
            <table className="doc infection-table">
              <colgroup><col style={{ width: "27%" }} /><col style={{ width: "51%" }} /><col style={{ width: "22%" }} /></colgroup>
              <thead><tr><th>原因微生物</th><th>主な原因食品</th><th>潜伏期間</th></tr></thead>
              <tbody>
                {DIARRHEA_INCUBATION.map((r) => (
                  <tr key={r.organism}>
                    <td data-label="原因微生物"><b>{r.organism}</b></td>
                    <td data-label="主な原因食品">{r.food}</td>
                    <td data-label="潜伏期間" className="mono">{r.incubation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section">
        <h3>治療の基本</h3>
        <ul className="notes infection-notes">{content.treatment.map((v) => <li key={v}>{v}</li>)}</ul>
      </section>

      <section className="section">
        <h3>抗菌薬を検討する状況</h3>
        <p className="lane-intro">抗菌薬を一律に投与する条件ではありません。検査、重症度、患者背景を合わせて判断します。</p>
        <ul className="notes infection-notes">{content.considerAntibiotics.map((v) => <li key={v}>{v}</li>)}</ul>
      </section>

      <section className="section">
        <h3>疾患メモ</h3>
        <ul className="notes infection-notes">{content.notes.map((v) => <li key={v}>{v}</li>)}</ul>
      </section>
      <SourceLine volume={APPROPRIATE_USE_GUIDE.outpatient} pages={content.pages} />
    </div>
  );
}

function HospitalOnset({
  mode,
  onOpenOrganism,
  onOpenOrganismList,
}: {
  mode: PatientMode;
  onOpenOrganism: (id: string) => void;
  onOpenOrganismList: () => void;
}) {
  return (
    <div>
      <div className="detail-head">
        <h2>{HOSPITAL_ONSET.title}</h2>
        <p className="en">{mode === "adult" ? "成人" : "小児"} ／ 適正使用の手引き 入院編 表2</p>
      </div>
      <div className="banner danger"><b>適用範囲：院内発症感染症</b><br />{HOSPITAL_ONSET.intro}</div>
      <p className="lane-intro">適正使用の手引きでは年齢別の表ではないため、成人・小児とも同じ原因微生物表を表示しています。</p>

      <section className="section">
        <h3>代表的な原因微生物</h3>
        <div className="hospital-infection-list">
          {HOSPITAL_ONSET.rows.map((row) => (
            <div className="card" key={row.infection}>
              <h4>{row.infection}</h4>
              <ul className="organism-links">
                {row.organisms.map((organism) => (
                  <li key={`${row.infection}-${organism.label}`}>
                    {organism.organismId ? (
                      <button className="organism-link" onClick={() => onOpenOrganism(organism.organismId!)}>
                        {organism.label}<span>アンチバイオグラムへ →</span>
                      </button>
                    ) : (
                      <div className="organism-unlinked">
                        <b>{organism.label}</b><span>{organism.note}</span>
                        {organism.note?.includes("菌種別一覧") && <button className="link-btn" onClick={onOpenOrganismList}>菌種別一覧を開く</button>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h3>疾患メモ</h3>
        <ul className="notes infection-notes">{HOSPITAL_ONSET.cautions.map((v) => <li key={v}>{v}</li>)}</ul>
      </section>
      <SourceLine volume={APPROPRIATE_USE_GUIDE.inpatient} pages={[HOSPITAL_ONSET.page]} />
    </div>
  );
}

export function InfectionGuide({
  id,
  mode,
  onOpenOrganism,
  onOpenOrganismList,
}: {
  id: InfectionGuideId;
  mode: PatientMode;
  onOpenOrganism: (id: string) => void;
  onOpenOrganismList: () => void;
}) {
  return id === "acute-diarrhea" ? (
    <AcuteDiarrhea mode={mode} />
  ) : (
    <HospitalOnset mode={mode} onOpenOrganism={onOpenOrganism} onOpenOrganismList={onOpenOrganismList} />
  );
}
