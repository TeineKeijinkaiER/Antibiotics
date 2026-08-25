import type { PatientState, PatientMode } from "../types";
import {
  cockcroftGault,
  idealBodyWeight,
  adjustedBodyWeight,
  isObeseByIbw,
  outOfRange,
  INPUT_RANGE,
} from "../lib/calc";

type Props = {
  mode: PatientMode;
  patient: PatientState;
  onChange: (p: PatientState) => void;
};

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(v: number | null, digits = 1): string {
  if (v == null) return "—";
  const f = 10 ** digits;
  return String(Math.round(v * f) / f);
}

export function PatientPanel({ mode, patient, onChange }: Props) {
  const set = <K extends keyof PatientState>(key: K, value: PatientState[K]) =>
    onChange({ ...patient, [key]: value });

  const ccr = cockcroftGault(patient);
  const ibw = idealBodyWeight(patient.height);
  const adj = adjustedBodyWeight(patient.weight, patient.height);
  const obese = isObeseByIbw(patient.weight, patient.height);

  const field = (
    key: "age" | "weight" | "height" | "scr" | "egfr",
    label: string,
    step = "any",
  ) => {
    const invalid = outOfRange(key, patient[key]);
    return (
      <div className="field" key={key}>
        <label htmlFor={`f-${key}`}>{label}</label>
        <input
          id={`f-${key}`}
          type="number"
          inputMode="decimal"
          step={step}
          className={invalid ? "invalid" : undefined}
          value={patient[key] ?? ""}
          onChange={(e) => set(key, num(e.target.value))}
        />
        {invalid && (
          <span className="hint">
            {INPUT_RANGE[key].min}–{INPUT_RANGE[key].max}
            {INPUT_RANGE[key].unit} の範囲で入力
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="card">
      <div className="patient-fields">
        {field("age", "年齢（歳）", "1")}
        <div className="field">
          <label htmlFor="f-sex">性別</label>
          <select
            id="f-sex"
            value={patient.sex ?? ""}
            onChange={(e) =>
              set("sex", e.target.value === "" ? null : (e.target.value as "male" | "female"))
            }
          >
            <option value="">—</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </div>
        {field("weight", "体重（kg）")}
        {field("height", "身長（cm）")}
        {field("scr", "血清Cr（mg/dL）")}
        {field("egfr", "eGFR")}
        <div className="field">
          <label htmlFor="f-rrt">腎代替療法</label>
          <select
            id="f-rrt"
            value={patient.rrt}
            onChange={(e) => set("rrt", e.target.value as PatientState["rrt"])}
          >
            <option value="none">なし</option>
            <option value="hd">血液透析（HD）</option>
            <option value="chdf">CHDF</option>
          </select>
        </div>
      </div>

      <div className="derived">
        <div className="item">
          <span>CCr（Cockcroft-Gault）</span>
          <b className="mono">{round(ccr)} mL/min</b>
        </div>
        <div className="item">
          <span>理想体重 IBW</span>
          <b className="mono">{round(ibw)} kg</b>
        </div>
        <div className="item">
          <span>補正体重 AdjBW</span>
          <b className="mono">{round(adj)} kg</b>
        </div>
        <div className="item">
          <span>患者条件</span>
          <button className="link-btn" onClick={() => onChange(emptyPatient())}>
            クリア
          </button>
        </div>
      </div>

      {obese === true && (
        <div className="banner warn" style={{ marginTop: 12, marginBottom: 0 }}>
          実体重が理想体重から20%以上乖離しています。アミノグリコシドの投与設計では
          <b>補正体重（AdjBW {round(adj)}kg）</b>を用いること（原典 p.34）。
        </div>
      )}

      {mode === "pediatric" && patient.weight == null && (
        <div className="banner info" style={{ marginTop: 12, marginBottom: 0 }}>
          小児モードでは体重が未入力のあいだ mg/kg 表記のみを表示します。体重を入力すると
          絶対量（mg）に換算して併記します。
        </div>
      )}

      <p className="source-line" style={{ marginTop: 12 }}>
        入力値は端末内にのみ保持され、外部に送信されません（要件 NFR-006）
      </p>
    </div>
  );
}

export function emptyPatient(): PatientState {
  return {
    age: null,
    sex: null,
    weight: null,
    height: null,
    scr: null,
    egfr: null,
    rrt: "none",
  };
}
