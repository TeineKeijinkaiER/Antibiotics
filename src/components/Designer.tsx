import { useState } from "react";
import type { PatientState, TdmProfile } from "../types";
import { DRUG_BY_ID } from "../data";
import {
  cockcroftGault,
  idealBodyWeight,
  adjustedBodyWeight,
  isObeseByIbw,
} from "../lib/calc";
import {
  parseFirstTdmDose,
  samplingSchedule,
  formatSamplingTime,
  parseDateTimeLocal,
} from "../lib/tdm";

const r1 = (v: number) => Math.round(v * 10) / 10;

/* ============================================================
 * 共通部品
 *
 * 全薬剤で「欠測時の作法」を統一する（UI再編 版2.0 §3.2(1)）。
 *   - 患者条件が未入力でも、原典の投与量表は全区分そのまま表示する
 *   - 該当区分が確定したときだけハイライトし、他を淡色化する
 *   - 確定していない区分を既定値として単独表示しない
 * ============================================================ */

/** 原典の投与量表の1行 */
type BandRow = {
  /** 区分名（"eGFR 90–120" など） */
  band: string;
  /** ローディング（初回）投与量。原典に記載がなければ省略 */
  loading?: string;
  /** 維持量（原典の表記そのまま） */
  dose: string;
  /** 患者条件から絶対量へ換算した文字列。換算できなければ null */
  converted?: string | null;
  /** この行に固有の警告 */
  alert?: { level: "warn" | "danger"; text: string };
};

function DoseTable({
  rows,
  activeBand,
}: {
  rows: BandRow[];
  /** 該当が確定した区分名。未確定なら null（どの行もハイライトしない） */
  activeBand: string | null;
}) {
  return (
    <div className="renal-grid">
      {rows.map((row) => {
        const state = activeBand == null ? "" : activeBand === row.band ? "active" : "dim";
        return (
          <div key={row.band} className={`renal-row ${state}`}>
            <div className="band">{row.band}</div>
            <div>
              {row.loading && (
                <div className="dose-load">
                  <span className="dose-load-tag">初回</span>
                  {row.loading}
                </div>
              )}
              <div className="dose-text">
                {row.loading && <span className="dose-load-tag maint">維持</span>}
                {row.dose}
              </div>
              {row.converted && <div className="dose-conv mono">→ {row.converted}</div>}
              {row.alert && (
                <div className={`banner ${row.alert.level}`} style={{ margin: "8px 0 0" }}>
                  {row.alert.text}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 不足している患者条件を「何が得られるか」とともに示し、その場で入力させる。
 * 文章だけで導線がない状態を作らない。
 */
function MissingInputs({
  items,
  onOpenPatient,
}: {
  items: string[];
  onOpenPatient?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="banner info">
      <b>患者条件が未入力です。</b>下の表は原典の全区分をそのまま表示しています。
      <ul className="notes" style={{ margin: "6px 0 0" }}>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      {onOpenPatient && (
        <button className="link-btn" onClick={onOpenPatient} style={{ marginTop: 4 }}>
          患者条件を入力する →
        </button>
      )}
    </div>
  );
}

/** 該当区分が確定したときに、その根拠を示す */
function ResolvedNote({ text }: { text: string }) {
  return (
    <p className="dose-note" style={{ marginTop: 8 }}>
      この患者の条件：<b>{text}</b> → 該当する区分を強調表示しています。
    </p>
  );
}

/* ---------------- 採血タイミング（原典データから構成） ---------------- */

function SamplingSection({ tdm, patient }: { tdm: TdmProfile; patient: PatientState }) {
  const defaultDose = parseFirstTdmDose(tdm.firstTdmDose) ?? 5;
  const [firstDoseAt, setFirstDoseAt] = useState("");
  const [interval, setInterval] = useState("");
  const [doseNumber, setDoseNumber] = useState(String(defaultDose));

  const schedule = samplingSchedule(
    parseDateTimeLocal(firstDoseAt),
    interval ? Number(interval) : null,
    doseNumber ? Number(doseNumber) : null,
  );
  const onDialysis = patient.rrt === "hd";

  return (
    <section className="section">
      <h3>採血のタイミング</h3>

      <div className="sampling-grid">
        {tdm.firstTdmDose && (
          <div className="sampling-item">
            <span>実施時期</span>
            <b>{tdm.firstTdmDose}</b>
          </div>
        )}
        {tdm.sampling.trough && (
          <div className="sampling-item">
            <span>トラフ</span>
            <b>{onDialysis ? "透析前に採血" : tdm.sampling.trough}</b>
          </div>
        )}
        {tdm.sampling.peak && tdm.sampling.peak !== "必要なし" && (
          <div className="sampling-item">
            <span>ピーク</span>
            <b>{tdm.sampling.peak}</b>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="dose-ind">採血日時を計算する</div>
        <p className="dose-note" style={{ margin: "2px 0 10px" }}>
          初回投与の日時と投与間隔から、何月何日の何時に採血すればよいかを示します。
          投与間隔とドーズ数の足し算のみで、血中濃度の推定は行いません。
        </p>
        <div className="patient-fields">
          <div className="field wide">
            <label htmlFor="tdm-first">初回投与の日時</label>
            <input
              id="tdm-first"
              type="datetime-local"
              value={firstDoseAt}
              onChange={(e) => setFirstDoseAt(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="tdm-interval">投与間隔（時間）</label>
            <input
              id="tdm-interval"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="12"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="tdm-dose-no">何ドーズ目の直前か</label>
            <input
              id="tdm-dose-no"
              type="number"
              inputMode="numeric"
              min={1}
              value={doseNumber}
              onChange={(e) => setDoseNumber(e.target.value)}
            />
          </div>
        </div>

        {schedule ? (
          <div className="dose-conv mono" style={{ marginTop: 12, fontSize: 15 }}>
            採血：{formatSamplingTime(schedule.at)}（{schedule.doseNumber}ドーズ目の投与直前 ／
            初回投与から {r1(schedule.hoursAfterFirst)} 時間後）
          </div>
        ) : (
          <p className="dose-note" style={{ marginTop: 10 }}>
            3項目すべてを入力すると採血日時を表示します（推定では埋めません）。
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------------- 目標血中濃度 ---------------- */

function TargetSection({
  targets,
  note,
}: {
  targets: { label: string; value: string }[];
  note?: string;
}) {
  return (
    <section className="section">
      <h3>目標血中濃度</h3>
      {targets.map((t) => (
        <div className="dose-row" key={t.label}>
          <div className="dose-ind">{t.label}</div>
          <div className="dose-text mono" style={{ fontSize: 17 }}>
            {t.value}
          </div>
        </div>
      ))}
      {note && <p className="dose-note" style={{ marginTop: 8 }}>{note}</p>}
    </section>
  );
}

type DesignerProps = {
  patient: PatientState;
  onOpenPatient?: () => void;
  /** 遷移元の薬剤ID。アミノグリコシドの初期選択に使う */
  fromDrugId?: string;
};

/* ============================================================
 * バンコマイシン（原典 p.31-32）
 * ============================================================ */

const VCM_BANDS: {
  band: string;
  test: (e: number) => boolean;
  dose: string;
  /** ローディング（初回）投与量 mg/kg。原典に記載がなければ null */
  loadingPerKg: number | null;
  /** 12時間毎の1回量（mg/kg）。範囲や条件付きの区分は null */
  perKg: number | null;
}[] = [
  { band: "eGFR > 120", test: (e) => e > 120, dose: "1回20mg/kg 12時間毎", loadingPerKg: 30, perKg: 20 },
  { band: "eGFR 90–120", test: (e) => e >= 90 && e <= 120, dose: "1回15mg/kg 12時間毎", loadingPerKg: 30, perKg: 15 },
  { band: "eGFR 80–90", test: (e) => e >= 80 && e < 90, dose: "1回12.5mg/kg 12時間毎", loadingPerKg: 30, perKg: 12.5 },
  { band: "eGFR 30–80", test: (e) => e >= 30 && e < 80, dose: "1回20–12.5mg/kg 24時間毎", loadingPerKg: 25, perKg: null },
  {
    band: "eGFR < 30",
    test: (e) => e < 30,
    dose: "15–20mg/kg 1回 ⇒ その後は血中濃度によってRe-dose考慮、又はTDM担当者に相談",
    loadingPerKg: null,
    perKg: null,
  },
];

const VCM_HD_BAND = "血液透析 (HD)";

function VancomycinDesigner({ patient, onOpenPatient }: DesignerProps) {
  const [severe, setSevere] = useState(false);
  const tdm = DRUG_BY_ID.get("vancomycin")?.tdm;
  const { weight, egfr } = patient;
  const onHd = patient.rrt === "hd";

  const matched = egfr != null ? VCM_BANDS.find((b) => b.test(egfr)) : undefined;
  const activeBand = onHd ? VCM_HD_BAND : (matched?.band ?? null);

  const rows: BandRow[] = VCM_BANDS.map((b) => {
    const perDose = b.perKg != null && weight != null ? r1(b.perKg * weight) : null;
    const dailyTotal = perDose != null ? perDose * 2 : null;
    let alert: BandRow["alert"];
    // 1日総量の上限警告は、該当区分が確定しているときにのみ出す
    if (activeBand === b.band && dailyTotal != null) {
      if (dailyTotal > 4000) {
        alert = {
          level: "danger",
          text: `1日総量が ${r1(dailyTotal)}mg で 4g を超えています。1日4gを上限とし、超える場合は他の抗MRSA薬への変更を考慮すること（原典 p.31）。`,
        };
      } else if (dailyTotal > 3000) {
        alert = {
          level: "warn",
          text: `1日総量が ${r1(dailyTotal)}mg で 3g を超えています。慎重に投与すること（原典 p.31）。`,
        };
      }
    }
    return {
      band: b.band,
      loading:
        b.loadingPerKg != null
          ? `${b.loadingPerKg}mg/kg` +
            (weight != null ? `（→ ${r1(b.loadingPerKg * weight)}mg）` : "")
          : undefined,
      dose: b.dose,
      converted:
        perDose != null
          ? `1回 ${perDose}mg 12時間毎、1日総量 ${r1(dailyTotal!)}mg（実体重 ${weight}kg）`
          : null,
      alert,
    };
  });

  rows.push({
    band: VCM_HD_BAND,
    loading: `20–25mg/kg${weight != null ? `（→ ${r1(20 * weight)}–${r1(25 * weight)}mg）` : ""}`,
    dose: "以降 7.5–10mg/kg を透析後に投与",
    converted:
      weight != null ? `→ 以降 ${r1(7.5 * weight)}–${r1(10 * weight)}mg（実体重 ${weight}kg）` : null,
  });

  const missing: string[] = [];
  if (egfr == null && !onHd) missing.push("eGFR — 入力すると該当する投与量の区分を判定します（原典の表はeGFR区分に基づくため、CCrからの自動変換は行いません）");
  if (weight == null) missing.push("体重 — 入力すると mg/kg を絶対量(mg)に換算します");

  return (
    <div>
      <div className="banner warn">
        これはあくまで<b>初期投与量</b>です。5ドーズ目以降でTDMを行うこと（重症例では2–4ドーズ目での測定を考慮）。
        体重は<b>実体重（Actual body weight）</b>で算出します。
      </div>

      <section className="section">
        <h3>初回・維持投与量</h3>
        <MissingInputs items={missing} onOpenPatient={onOpenPatient} />
        {onHd && <ResolvedNote text="血液透析" />}
        {!onHd && matched && egfr != null && <ResolvedNote text={`eGFR ${egfr}`} />}
        <DoseTable rows={rows} activeBand={activeBand} />
        <p className="dose-note" style={{ marginTop: 8 }}>
          ローディングの母液は生食250mLで溶解し2時間で投与。点滴時間は1g/hr以上かけること。
        </p>
        <p className="source-line">原典 p.31</p>
      </section>

      {tdm && <SamplingSection tdm={tdm} patient={patient} />}

      <label className="check-line">
        <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} />
        <span>菌血症・心内膜炎・骨髄炎・髄膜炎・院内肺炎 のいずれか</span>
      </label>

      <TargetSection
        targets={[{ label: severe ? "トラフ（重症例）" : "トラフ（通常）", value: severe ? "15–20 µg/mL" : "10–15 µg/mL" }]}
        note="ピークの目標値はありません。"
      />

      <section className="section">
        <h3>AUCガイドによるTDM</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>
          MRSA菌血症で<b>感染症科・ASTによる推奨がある場合</b>に使用します。日本化学療法学会が提供する
          Practical AUC-guided TDM（PAT）を用い、本アプリでは計算しません。目標 AUC/MIC は 400〜600。
          MICが1の菌株に使用し、MICが2以上の場合は他の抗MRSA薬への変更を検討します。透析患者には適用できません。
          Peak（投与終了後60分）とTrough（投与直前）の2点採血が必要なため、実施時は速やかに薬剤部（病棟薬剤師）へ連絡してください。
        </p>
        <p className="source-line">
          PAT: https://antimicrobials.mipdapps.net/shiny/rstudio/vancomycinPAT4_0c/ ／ 原典 p.32
        </p>
      </section>
    </div>
  );
}

/* ============================================================
 * テイコプラニン（原典 p.33）
 * ============================================================ */

function TeicoplaninDesigner({ patient, onOpenPatient }: DesignerProps) {
  const [severe, setSevere] = useState(false);
  const tdm = DRUG_BY_ID.get("teicoplanin")?.tdm;
  const w = patient.weight;

  const NORMAL_BAND = "腎機能正常（初日〜3日目は腎機能低下例も同じ）";
  const HD_BAND = "血液透析 (HD)";
  const CHDF_BAND = "CHDF";

  const activeBand =
    patient.rrt === "hd" ? HD_BAND : patient.rrt === "chdf" ? CHDF_BAND : NORMAL_BAND;

  const rows: BandRow[] = [
    {
      band: NORMAL_BAND,
      loading: `12mg/kg（早期に有効血中濃度を維持したい場合）${w != null ? `（→ ${r1(12 * w)}mg）` : ""}`,
      dose: "6mg/kg 12時間毎 2日間、3日目以降はTDM担当者に相談しRe-dose考慮",
      converted: w != null ? `1回 ${r1(6 * w)}mg 12時間毎（実体重 ${w}kg）` : null,
    },
    {
      band: HD_BAND,
      dose: "6mg/kg 72時間毎、透析日は透析後に投与、TDM推奨",
      converted: w != null ? `1回 ${r1(6 * w)}mg 72時間毎（実体重 ${w}kg）` : null,
    },
    {
      band: CHDF_BAND,
      dose: "1日目：800mg/day、2・3日目：400mg/day、4日目以降：400mg 48–72時間毎、TDM推奨",
      converted: null,
    },
  ];

  const missing: string[] = [];
  if (w == null) missing.push("体重 — 入力すると mg/kg を絶対量(mg)に換算します");

  return (
    <div>
      <div className="banner warn">
        これはあくまで<b>初期投与量</b>です。5ドーズ目以降でTDMを行うこと。テイコプラニンは半減期が長く、
        定常状態への到達が遅れることを考慮してください。
      </div>
      <div className="banner info">
        <b>腎機能低下患者においても、初日よりLoading doseを含め3日間は腎機能正常患者と同じ投与を行います。</b>
        その後にTDMを実施し、投与間隔の延長又は1回投与量の減量を行います（原典 p.33）。
      </div>

      <section className="section">
        <h3>初回・維持投与量</h3>
        <MissingInputs items={missing} onOpenPatient={onOpenPatient} />
        <ResolvedNote
          text={
            patient.rrt === "hd" ? "血液透析" : patient.rrt === "chdf" ? "CHDF" : "腎代替療法なし"
          }
        />
        <DoseTable rows={rows} activeBand={activeBand} />
        <p className="source-line">原典 p.33</p>
      </section>

      {tdm && <SamplingSection tdm={tdm} patient={patient} />}

      <label className="check-line">
        <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} />
        <span>重症例（感染性心内膜炎、骨関節感染症等）</span>
      </label>

      <TargetSection
        targets={[
          {
            label: severe ? "トラフ（重症例）" : "トラフ（通常）",
            value: severe ? "20–30 µg/mL 以上を考慮" : "10–30 µg/mL",
          },
        ]}
        note="ピークの測定は必要ありません。"
      />
    </div>
  );
}

/* ============================================================
 * アミノグリコシド（原典 p.34-35）
 * ============================================================ */

type AgDrug = "gentamicin" | "amikacin";
type AgMethod = "odd" | "mdd" | "endocarditis";

const AG_LABEL: Record<AgDrug, string> = { gentamicin: "ゲンタマイシン", amikacin: "アミカシン" };

function AminoglycosideDesigner({ patient, onOpenPatient, fromDrugId }: DesignerProps) {
  // 遷移元の薬剤を初期選択にする（GM/AMK のどちらから来たかを反映する）
  const [drug, setDrug] = useState<AgDrug>(fromDrugId === "amikacin" ? "amikacin" : "gentamicin");
  const [method, setMethod] = useState<AgMethod>("odd");
  const [severeMic, setSevereMic] = useState(false);

  const tdm = DRUG_BY_ID.get(drug)?.tdm;
  const ccr = cockcroftGault(patient);
  const ibw = idealBodyWeight(patient.height);
  const adj = adjustedBodyWeight(patient.weight, patient.height);
  const obese = isObeseByIbw(patient.weight, patient.height);

  // ODD/MDD の投与量は理想体重(IBW)で算出する（原典 p.34 の表）
  const ibwDose = (perKg: number) => (ibw == null ? null : r1(perKg * ibw));

  const HIGH = "CCr > 50 mL/min";
  const MID = "CCr 10–50 mL/min";
  const LOW = "CCr < 10 mL/min";
  const AG_MID = "CCr ≦ 50 mL/min";

  /**
   * 該当区分の判定。CCr が未入力なら null を返し、どの行も強調しない。
   * 以前は CCr 未入力が「CCr > 50」の分岐に落ち、腎機能正常時の用量が
   * 既定値として表示されていた（版2.0 §3.1 不具合B）。
   */
  let rows: BandRow[] = [];
  let activeBand: string | null = null;

  if (method === "odd") {
    const perKg = drug === "gentamicin" ? 5 : 15;
    rows = [
      {
        band: HIGH,
        dose: `理想体重で1回${perKg}mg/kg 24時間毎（1日1回法・適応外使用）`,
        converted: ibwDose(perKg) != null ? `1回 ${ibwDose(perKg)}mg 24時間毎（理想体重 ${r1(ibw!)}kg）` : null,
      },
      {
        band: AG_MID,
        dose: "Multiple daily dosing（MDD）を用いるか、もしくは専門家へコンサルテーション",
        converted: null,
      },
    ];
    if (ccr != null) activeBand = ccr > 50 ? HIGH : AG_MID;
  } else if (method === "mdd") {
    const perKg = drug === "gentamicin" ? 1.7 : 7.5;
    const interval = drug === "gentamicin" ? "8時間毎" : "12時間毎";
    rows = [
      {
        band: HIGH,
        dose: `理想体重で1回${perKg}mg/kg ${interval}`,
        converted: ibwDose(perKg) != null ? `1回 ${ibwDose(perKg)}mg ${interval}（理想体重 ${r1(ibw!)}kg）` : null,
      },
      {
        band: MID,
        dose:
          drug === "gentamicin"
            ? "理想体重で1回1.2–1.5mg/kg 12時間毎"
            : "理想体重で1回2–5mg/kg 12–18時間毎",
        converted: null,
      },
      { band: LOW, dose: "専門家へコンサルテーション", converted: null },
    ];
    if (ccr != null) activeBand = ccr > 50 ? HIGH : ccr >= 10 ? MID : LOW;
  } else {
    if (drug === "amikacin") {
      rows = [
        {
          band: "—",
          dose: "原典に記載なし（ゲンタマイシンの併用療法のみ記載）",
          converted: null,
        },
      ];
    } else {
      rows = [
        {
          band: HIGH,
          dose: "腸球菌・連鎖球菌群による感染性心内膜炎への併用療法：理想体重で1回1mg/kg 8時間毎、又は理想体重で1回3mg/kg 24時間毎",
          converted:
            ibw != null
              ? `1回 ${ibwDose(1)}mg 8時間毎、又は 1回 ${ibwDose(3)}mg 24時間毎（理想体重 ${r1(ibw)}kg）`
              : null,
        },
        { band: AG_MID, dose: "専門家へコンサルテーション", converted: null },
      ];
      if (ccr != null) activeBand = ccr > 50 ? HIGH : AG_MID;
    }
  }

  const targets =
    method === "endocarditis"
      ? [
          { label: "ピーク", value: "3 µg/mL" },
          { label: "トラフ", value: "<1 µg/mL" },
        ]
      : method === "mdd"
        ? drug === "gentamicin"
          ? [
              { label: "ピーク", value: "5–10 µg/mL" },
              { label: "トラフ", value: "1–2 µg/mL" },
            ]
          : [
              { label: "ピーク", value: "15–30 µg/mL" },
              { label: "トラフ", value: "5–10 µg/mL" },
            ]
        : drug === "gentamicin"
          ? severeMic
            ? [
                { label: "ピーク（MIC 2µg/mL または重症）", value: "15–20 µg/mL" },
                { label: "トラフ", value: "<1 µg/mL" },
              ]
            : [
                { label: "ピーク（MIC 1µg/mL以下 または軽症）", value: "8–10 µg/mL" },
                { label: "トラフ", value: "<1 µg/mL" },
              ]
          : severeMic
            ? [
                { label: "ピーク（MIC 8µg/mL または重症）", value: "50–60 µg/mL" },
                { label: "トラフ", value: "<4 µg/mL" },
              ]
            : [
                { label: "ピーク（MIC 4µg/mL以下 または軽症）", value: "40–50 µg/mL" },
                { label: "トラフ", value: "<4 µg/mL" },
              ];

  const missing: string[] = [];
  if (ccr == null) missing.push("年齢・性別・体重・血清Cr — 入力すると CCr を計算し、該当する区分を判定します");
  if (ibw == null) missing.push("身長 — 入力すると理想体重(IBW)から絶対量に換算します");

  return (
    <div>
      <div className="banner warn">
        これはあくまで<b>初期投与量</b>です。2ドーズ目以降で必要に応じてTDMを行うことを推奨します
        （5日以上投与の可能性、腎機能低下例、VCM・AMPH-B・シクロスポリン・造影剤等の併用時）。
      </div>

      <div className="tabs">
        {(Object.keys(AG_LABEL) as AgDrug[]).map((k) => (
          <button key={k} className="tab" aria-pressed={drug === k} onClick={() => setDrug(k)}>
            {AG_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="tabs">
        <button className="tab" aria-pressed={method === "odd"} onClick={() => setMethod("odd")}>1日1回法（ODD）</button>
        <button className="tab" aria-pressed={method === "mdd"} onClick={() => setMethod("mdd")}>分割法（MDD）</button>
        <button className="tab" aria-pressed={method === "endocarditis"} onClick={() => setMethod("endocarditis")}>心内膜炎 併用療法</button>
      </div>

      {obese === true && (
        <div className="banner warn">
          実体重が理想体重から20%以上乖離しています。原典は「実体重で算出、ただしこの場合は
          <b>補正体重（AdjBW {adj != null ? r1(adj) : "—"}kg）</b>を用いる」としています（p.34）。
          下の換算値は原典の表に従い理想体重で算出しているため、投与設計時に確認してください。
        </div>
      )}

      {method === "odd" && (
        <label className="check-line">
          <input type="checkbox" checked={severeMic} onChange={(e) => setSevereMic(e.target.checked)} />
          <span>{drug === "gentamicin" ? "MIC 2µg/mL または重症" : "MIC 8µg/mL または重症"}</span>
        </label>
      )}

      <section className="section">
        <h3>初回投与量（{AG_LABEL[drug]}）</h3>
        <MissingInputs items={missing} onOpenPatient={onOpenPatient} />
        {ccr != null && <ResolvedNote text={`CCr ${r1(ccr)} mL/min`} />}
        <DoseTable rows={rows} activeBand={activeBand} />
        <p className="source-line">原典 p.34-35</p>
      </section>

      {tdm && <SamplingSection tdm={tdm} patient={patient} />}

      <TargetSection
        targets={targets}
        note={
          drug === "gentamicin"
            ? "ゲンタマイシンは院内で測定します。"
            : "アミカシンは院外測定（外注）です。報告までに日数がかかるため、採血の計画時に考慮してください。"
        }
      />
    </div>
  );
}

/* ============================================================
 * ボリコナゾール（原典 p.36）
 * ============================================================ */

function VoriconazoleDesigner({ patient, onOpenPatient }: DesignerProps) {
  const [route, setRoute] = useState<"iv" | "po">("iv");
  const tdm = DRUG_BY_ID.get("voriconazole")?.tdm;
  const w = patient.weight;
  const ccr = cockcroftGault(patient);
  const ivContraindicated = ccr != null && ccr <= 30;

  const OVER40 = "体重 40kg 以上";
  const UNDER40 = "体重 40kg 未満";
  const activeBand = w == null ? null : w < 40 ? UNDER40 : OVER40;

  const rows: BandRow[] =
    route === "iv"
      ? [
          {
            band: OVER40,
            loading: `初日 6mg/kg を1日2回${w != null && w >= 40 ? `（→ 1回 ${r1(6 * w)}mg）` : ""}`,
            dose: "2日目以降 3–4mg/kg を1日2回",
            converted:
              w != null && w >= 40
                ? `1回 ${r1(3 * w)}–${r1(4 * w)}mg 1日2回（実体重 ${w}kg）`
                : null,
          },
          {
            band: UNDER40,
            dose: "原典の注射剤の表は40kg以上のみを示しています。経口剤の40kg未満の用量を参照してください。",
            converted: null,
          },
        ]
      : [
          {
            band: OVER40,
            loading: "初日 1回300mg 1日2回",
            dose: "2日目以降 1回150–200mg 1日2回（食間）",
            converted: null,
          },
          {
            band: UNDER40,
            loading: "初日 1回150mg 1日2回",
            dose: "2日目以降 1回100mg 1日2回（食間）",
            converted: null,
          },
        ];

  const missing: string[] = [];
  if (w == null) missing.push("体重 — 入力すると 40kg を境に該当する用量の区分を判定します");
  if (ccr == null) missing.push("年齢・性別・体重・血清Cr — 入力すると CCr を計算し、注射剤の可否を判定します");

  return (
    <div>
      <div className="banner warn">
        治療開始後、臨床効果が乏しい場合や肝機能障害が認められた場合はTDMの実施を考慮します。
        TDMは<b>投与開始2–5日目</b>に行います。CYP2C9、2C19、3A4と相互作用を起こす薬剤の併用時は
        血中濃度の変動に注意してください。
      </div>

      <div className="tabs">
        <button className="tab" aria-pressed={route === "iv"} onClick={() => setRoute("iv")}>注射（200mg静注用）</button>
        <button className="tab" aria-pressed={route === "po"} onClick={() => setRoute("po")}>経口（50mg・200mg錠）</button>
      </div>

      {ivContraindicated && route === "iv" && (
        <div className="banner danger">
          <b>CCr {r1(ccr!)} mL/min — 注射剤は投与禁忌です。</b>
          可溶化剤のSBECDが蓄積するため、CCrが30mL/min以下では注射剤を使用しません。経口剤での治療を考慮してください（原典 p.36）。
        </div>
      )}
      {ccr != null && ccr > 30 && ccr <= 50 && route === "iv" && (
        <div className="banner warn">
          CCr {r1(ccr)} mL/min — 中等度以上の腎障害（CCr 30–50mL/min）ではSBECDが蓄積します。経口剤での治療を考慮してください。
        </div>
      )}

      <section className="section">
        <h3>初回・維持投与量（{route === "iv" ? "注射" : "経口"}）</h3>
        <MissingInputs items={missing} onOpenPatient={onOpenPatient} />
        {w != null && <ResolvedNote text={`実体重 ${w}kg`} />}
        <DoseTable rows={rows} activeBand={activeBand} />
        <p className="source-line">原典 p.36</p>
      </section>

      {tdm && <SamplingSection tdm={tdm} patient={patient} />}

      <TargetSection
        targets={[{ label: "トラフ", value: "1–4 µg/mL" }]}
        note="血中濃度測定は院外（外注）です。月曜朝採血：火曜測定→水曜or木曜報告／木曜朝採血：金曜測定→土曜or翌週月曜報告。外来でTDMを行う場合は薬剤部担当者へ連絡し、採血コメントに「外注採血あり」を入力してください（VRCZの検査オーダーは行わない）。"
      />

      <div className="banner info">
        肥満患者では補正体重
        {adjustedBodyWeight(patient.weight, patient.height) != null &&
          `（AdjBW ${r1(adjustedBodyWeight(patient.weight, patient.height)!)}kg）`}
        を用いた投与設計を考慮します。副作用の視覚障害は一過性の場合が多いものの、血中濃度上昇と関連性が報告されています。
      </div>
    </div>
  );
}

/* ---------------- entry ---------------- */

export const DESIGNERS: Record<
  string,
  { title: string; render: (p: DesignerProps) => JSX.Element }
> = {
  vancomycin: { title: "バンコマイシン 投与設計", render: (p) => <VancomycinDesigner {...p} /> },
  teicoplanin: { title: "テイコプラニン 投与設計", render: (p) => <TeicoplaninDesigner {...p} /> },
  aminoglycoside: { title: "アミノグリコシド 投与設計", render: (p) => <AminoglycosideDesigner {...p} /> },
  voriconazole: { title: "ボリコナゾール 投与設計", render: (p) => <VoriconazoleDesigner {...p} /> },
};

export function Designer({
  designerKey,
  patient,
  onOpenPatient,
  fromDrugId,
  onOpenDrug,
}: {
  designerKey: string;
  patient: PatientState;
  onOpenPatient?: () => void;
  fromDrugId?: string;
  onOpenDrug?: (id: string) => void;
}) {
  const d = DESIGNERS[designerKey];
  if (!d) return <p className="empty">投与設計ツールが見つかりません。</p>;
  const fromDrug = fromDrugId ? DRUG_BY_ID.get(fromDrugId) : undefined;

  return (
    <div>
      <div className="detail-head">
        <h2>{d.title}</h2>
        <p className="en">原典に記載された表・式のみを実装しています（独自の薬物動態推定は行いません）</p>
        {fromDrug && onOpenDrug && (
          <button className="link-btn" onClick={() => onOpenDrug(fromDrug.id)}>
            ← {fromDrug.genericName.ja}の薬剤詳細に戻る
          </button>
        )}
      </div>
      {d.render({ patient, onOpenPatient, fromDrugId })}
    </div>
  );
}
