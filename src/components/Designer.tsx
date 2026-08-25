import { useState } from "react";
import type { PatientState } from "../types";
import {
  cockcroftGault,
  idealBodyWeight,
  adjustedBodyWeight,
  isObeseByIbw,
} from "../lib/calc";

const r1 = (v: number) => Math.round(v * 10) / 10;

function Result({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      {children}
    </div>
  );
}

/* ---------------- Vancomycin（原典 p.31-32） ---------------- */

const VCM_TABLE: { band: string; test: (e: number) => boolean; dose: string; loading: string | null }[] = [
  { band: "eGFR > 120", test: (e) => e > 120, dose: "1回20mg/kg 12時間毎", loading: "初回30mg/kg" },
  { band: "eGFR 90–120", test: (e) => e >= 90 && e <= 120, dose: "1回15mg/kg 12時間毎", loading: "初回30mg/kg" },
  { band: "eGFR 80–90", test: (e) => e >= 80 && e < 90, dose: "1回12.5mg/kg 12時間毎", loading: "初回30mg/kg" },
  { band: "eGFR 30–80", test: (e) => e >= 30 && e < 80, dose: "1回20–12.5mg/kg 24時間毎", loading: "初回25mg/kg" },
  { band: "eGFR < 30", test: (e) => e < 30, dose: "15–20mg/kg 1回 ⇒ その後は血中濃度によってRe-dose考慮、又はTDM担当者に相談", loading: null },
];

const VCM_SEVERE_INDICATIONS = [
  "菌血症",
  "心内膜炎",
  "骨髄炎",
  "髄膜炎",
  "院内肺炎",
];

function VancomycinDesigner({ patient }: { patient: PatientState }) {
  const [severe, setSevere] = useState(false);
  const weight = patient.weight;
  const egfr = patient.egfr;
  const onHd = patient.rrt === "hd";

  const band = egfr != null ? VCM_TABLE.find((b) => b.test(egfr)) : undefined;

  // mg/kg → 絶対量。実体重（Actual body weight）で算出する（原典 p.31）
  const calc = (perKg: number) => (weight == null ? null : r1(perKg * weight));

  const perDose = band && weight != null
    ? band.band === "eGFR > 120" ? calc(20)
    : band.band === "eGFR 90–120" ? calc(15)
    : band.band === "eGFR 80–90" ? calc(12.5)
    : null
    : null;

  const dailyMax = perDose != null && band && band.band !== "eGFR 30–80" ? perDose * 2 : null;

  return (
    <div>
      <div className="banner warn">
        これはあくまで<b>初期投与量</b>です。5ドーズ目以降でTDMを行うこと（重症例では2–4ドーズ目での測定を考慮）。
        体重は<b>実体重（Actual body weight）</b>で算出します。
      </div>

      {egfr == null && !onHd && (
        <div className="banner info">
          患者条件パネルで <b>eGFR</b> を入力してください。バンコマイシンの初期投与量表は eGFR 区分に基づきます（CCrからの自動変換は行いません）。
        </div>
      )}
      {weight == null && (
        <div className="banner info">患者条件パネルで <b>体重</b> を入力すると絶対量に換算します。</div>
      )}

      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} />
        <span>{VCM_SEVERE_INDICATIONS.join("・")} のいずれか</span>
      </label>

      {onHd ? (
        <Result>
          <div className="dose-ind">透析患者</div>
          <div className="dose-text">初回20–25mg/kg、以降7.5–10mg/kgを透析後</div>
          {weight != null && (
            <div className="dose-conv mono">
              → 初回 {r1(20 * weight)}–{r1(25 * weight)}mg、以降 {r1(7.5 * weight)}–{r1(10 * weight)}mg（実体重 {weight}kg）
            </div>
          )}
        </Result>
      ) : band ? (
        <Result>
          <div className="dose-ind">{band.band}</div>
          <div className="dose-text">{band.dose}</div>
          {band.loading && <div className="dose-note">ローディング：{band.loading}（点滴時間は1g/hr以上かける）</div>}
          {perDose != null && (
            <div className="dose-conv mono">
              → 1回 {perDose}mg 12時間毎（実体重 {weight}kg）
              {dailyMax != null && `　1日総量 ${r1(dailyMax)}mg`}
            </div>
          )}
          {dailyMax != null && dailyMax > 4000 && (
            <div className="banner danger" style={{ marginTop: 10, marginBottom: 0 }}>
              1日総量が <b>4g を超えています</b>。1日4gを上限とし、超える場合は他の抗MRSA薬への変更を考慮すること（原典 p.31）。
            </div>
          )}
          {dailyMax != null && dailyMax > 3000 && dailyMax <= 4000 && (
            <div className="banner warn" style={{ marginTop: 10, marginBottom: 0 }}>
              1日総量が <b>3g を超えています</b>。慎重に投与すること（原典 p.31）。
            </div>
          )}
        </Result>
      ) : null}

      <Result>
        <div className="dose-ind">目標トラフ値</div>
        <div className="dose-text mono" style={{ fontSize: 18 }}>
          {severe ? "15–20 µg/mL" : "10–15 µg/mL"}
        </div>
        <div className="dose-note">
          採血タイミング：バンコマイシン投与直前（透析患者の場合は透析前）。ピークの目標値はなし。
        </div>
      </Result>

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

/* ---------------- Teicoplanin（原典 p.33） ---------------- */

function TeicoplaninDesigner({ patient }: { patient: PatientState }) {
  const [severe, setSevere] = useState(false);
  const w = patient.weight;
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

      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} />
        <span>重症例（感染性心内膜炎、骨関節感染症等）</span>
      </label>

      <Result>
        <div className="dose-ind">初期投与量（腎機能正常）</div>
        <div className="dose-text">6mg/kg 12時間毎 2日間、3日目以降はTDM担当者に相談しRe-dose考慮</div>
        {w != null && <div className="dose-conv mono">→ 1回 {r1(6 * w)}mg 12時間毎（実体重 {w}kg）</div>}
        <div className="dose-note">早期に有効血中濃度を維持したい場合は Loading dose 12mg/kg を考慮
          {w != null && `（→ ${r1(12 * w)}mg）`}</div>
      </Result>

      <Result>
        <div className="dose-ind">目標トラフ値</div>
        <div className="dose-text mono" style={{ fontSize: 18 }}>
          {severe ? "20–30 µg/mL 以上を考慮" : "10–30 µg/mL"}
        </div>
        <div className="dose-note">採血：テイコプラニン投与直前（透析患者の場合は透析前）。ピークは必要なし。</div>
      </Result>

      {patient.rrt === "hd" && (
        <Result>
          <div className="dose-ind">血液透析</div>
          <div className="dose-text">6mg/kg 72時間毎、透析日は透析後に投与、TDM推奨</div>
        </Result>
      )}
      {patient.rrt === "chdf" && (
        <Result>
          <div className="dose-ind">CHDF</div>
          <div className="dose-text">
            1日目：800mg/day、2・3日目：400mg/day、4日目以降：400mg 48–72時間毎、TDM推奨
          </div>
        </Result>
      )}
      <p className="source-line">原典 p.33</p>
    </div>
  );
}

/* ---------------- Aminoglycoside（原典 p.34-35） ---------------- */

type AgDrug = "gentamicin" | "amikacin";
type AgMethod = "odd" | "mdd" | "endocarditis";

function AminoglycosideDesigner({ patient }: { patient: PatientState }) {
  const [drug, setDrug] = useState<AgDrug>("gentamicin");
  const [method, setMethod] = useState<AgMethod>("odd");
  const [severeMic, setSevereMic] = useState(false);

  const ccr = cockcroftGault(patient);
  const ibw = idealBodyWeight(patient.height);
  const adj = adjustedBodyWeight(patient.weight, patient.height);
  const obese = isObeseByIbw(patient.weight, patient.height);

  // ODD/MDD の投与量は理想体重(IBW)で算出する（原典 p.34 の表）。
  // 一方、MDD・心内膜炎併用の体重基準は「実体重、ただしIBWから20%以上乖離すれば補正体重」と
  // 注記されているため、両方を提示して判断を委ねる。
  const ibwDose = (perKg: number) => (ibw == null ? null : r1(perKg * ibw));

  const rows: { label: string; text: string; converted: string | null }[] = [];

  if (method === "odd") {
    if (ccr != null && ccr <= 50) {
      rows.push({
        label: "CCr ≦ 50 mL/min",
        text: "Multiple daily dosing（MDD）を用いるか、もしくは専門家へコンサルテーション",
        converted: null,
      });
    } else {
      const perKg = drug === "gentamicin" ? 5 : 15;
      rows.push({
        label: "CCr > 50 mL/min（1日1回法・適応外使用）",
        text: `理想体重で1回${perKg}mg/kg 24時間毎`,
        converted: ibwDose(perKg) != null ? `1回 ${ibwDose(perKg)}mg 24時間毎（理想体重 ${r1(ibw!)}kg）` : null,
      });
    }
  } else if (method === "mdd") {
    if (ccr != null && ccr < 10) {
      rows.push({ label: "CCr < 10 mL/min", text: "専門家へコンサルテーション", converted: null });
    } else if (ccr != null && ccr <= 50) {
      const text =
        drug === "gentamicin"
          ? "理想体重で1回1.2–1.5mg/kg 12時間毎"
          : "理想体重で1回2–5mg/kg 12–18時間毎";
      rows.push({ label: "CCr 10–50 mL/min", text, converted: null });
    } else {
      const perKg = drug === "gentamicin" ? 1.7 : 7.5;
      const interval = drug === "gentamicin" ? "8時間毎" : "12時間毎";
      rows.push({
        label: "CCr > 50 mL/min",
        text: `理想体重で1回${perKg}mg/kg ${interval}`,
        converted: ibwDose(perKg) != null ? `1回 ${ibwDose(perKg)}mg ${interval}（理想体重 ${r1(ibw!)}kg）` : null,
      });
    }
  } else {
    if (drug === "amikacin") {
      rows.push({ label: "—", text: "原典に記載なし（ゲンタマイシンの併用療法のみ記載）", converted: null });
    } else if (ccr != null && ccr <= 50) {
      rows.push({ label: "CCr ≦ 50 mL/min", text: "専門家へコンサルテーション", converted: null });
    } else {
      rows.push({
        label: "腸球菌・連鎖球菌群による感染性心内膜炎への併用療法",
        text: "理想体重で1回1mg/kg 8時間毎、又は理想体重で1回3mg/kg 24時間毎",
        converted:
          ibw != null
            ? `1回 ${ibwDose(1)}mg 8時間毎、又は 1回 ${ibwDose(3)}mg 24時間毎（理想体重 ${r1(ibw)}kg）`
            : null,
      });
    }
  }

  const targets =
    method === "endocarditis"
      ? ["Peak 3 µg/mL", "Trough <1 µg/mL"]
      : method === "mdd"
        ? drug === "gentamicin"
          ? ["Peak 5–10 µg/mL", "Trough 1–2 µg/mL"]
          : ["Peak 15–30 µg/mL", "Trough 5–10 µg/mL"]
        : drug === "gentamicin"
          ? severeMic
            ? ["Peak 15–20 µg/mL（MIC 2µg/mL または重症）", "Trough <1 µg/mL"]
            : ["Peak 8–10 µg/mL（MIC 1µg/mL以下 または軽症）", "Trough <1 µg/mL"]
          : severeMic
            ? ["Peak 50–60 µg/mL（MIC 8µg/mL または重症）", "Trough <4 µg/mL"]
            : ["Peak 40–50 µg/mL（MIC 4µg/mL以下 または軽症）", "Trough <4 µg/mL"];

  return (
    <div>
      <div className="banner warn">
        これはあくまで<b>初期投与量</b>です。2ドーズ目以降で必要に応じてTDMを行うことを推奨します
        （5日以上投与の可能性、腎機能低下例、VCM・AMPH-B・シクロスポリン・造影剤等の併用時）。
      </div>

      <div className="tabs">
        <button className="tab" aria-pressed={drug === "gentamicin"} onClick={() => setDrug("gentamicin")}>ゲンタマイシン</button>
        <button className="tab" aria-pressed={drug === "amikacin"} onClick={() => setDrug("amikacin")}>アミカシン</button>
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
      {ccr == null && (
        <div className="banner info">患者条件パネルで年齢・性別・体重・Crを入力するとCCr区分を自動判定します。</div>
      )}
      {ibw == null && (
        <div className="banner info">身長を入力すると理想体重（IBW）から絶対量に換算します。</div>
      )}

      {method === "odd" && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
          <input type="checkbox" checked={severeMic} onChange={(e) => setSevereMic(e.target.checked)} />
          <span>{drug === "gentamicin" ? "MIC 2µg/mL または重症" : "MIC 8µg/mL または重症"}</span>
        </label>
      )}

      {rows.map((row, i) => (
        <Result key={i}>
          <div className="dose-ind">{row.label}</div>
          <div className="dose-text">{row.text}</div>
          {row.converted && <div className="dose-conv mono">→ {row.converted}</div>}
        </Result>
      ))}

      <Result>
        <div className="dose-ind">目標血中濃度</div>
        {targets.map((t) => (
          <div className="dose-text mono" key={t}>{t}</div>
        ))}
        <div className="dose-note">
          採血：Peak は投与終了後30分、Trough は投与直前（透析患者の場合は透析前）。
          {drug === "gentamicin" ? "ゲンタマイシンは院内測定。" : "アミカシンは院外測定（外注）。"}
        </div>
      </Result>
      <p className="source-line">原典 p.34-35</p>
    </div>
  );
}

/* ---------------- Voriconazole（原典 p.36） ---------------- */

function VoriconazoleDesigner({ patient }: { patient: PatientState }) {
  const [route, setRoute] = useState<"iv" | "po">("iv");
  const w = patient.weight;
  const ccr = cockcroftGault(patient);
  const ivContraindicated = ccr != null && ccr <= 30;
  const under40 = w != null && w < 40;

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

      {ivContraindicated && (
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
      {w == null && <div className="banner info">患者条件パネルで<b>体重</b>を入力すると用量が確定します（40kg で分岐）。</div>}

      {route === "iv" ? (
        <Result>
          <div className="dose-ind">成人（40kg以上）・注射</div>
          <div className="dose-text">初日 6mg/kg を1日2回、2日目以降 3–4mg/kg を1日2回</div>
          {w != null && !under40 && (
            <div className="dose-conv mono">
              → 初日 1回 {r1(6 * w)}mg 1日2回、2日目以降 1回 {r1(3 * w)}–{r1(4 * w)}mg 1日2回（実体重 {w}kg）
            </div>
          )}
          {under40 && (
            <div className="banner info" style={{ marginTop: 10, marginBottom: 0 }}>
              体重40kg未満です。原典の注射剤の表は40kg以上のみを示しているため、経口剤の40kg未満の用量を参照してください。
            </div>
          )}
        </Result>
      ) : (
        <Result>
          <div className="dose-ind">成人・経口（{under40 ? "40kg未満" : "40kg以上"}）</div>
          <div className="dose-text">
            {under40
              ? "初日 1回150mg 1日2回、2日目以降は1回100mg 1日2回（食間）"
              : "初日 1回300mg 1日2回、2日目以降は1回150–200mg 1日2回（食間）"}
          </div>
          {w == null && (
            <div className="dose-note">体重が未入力のため40kg以上の用量を表示しています。</div>
          )}
        </Result>
      )}

      <Result>
        <div className="dose-ind">目標トラフ値</div>
        <div className="dose-text mono" style={{ fontSize: 18 }}>1–4 µg/mL</div>
        <div className="dose-note">
          採血：投与直前（透析患者の場合は透析前）。ピークは必要なし。血中濃度測定は院外（外注）
          — 月曜朝採血：火曜測定→水曜or木曜報告／木曜朝採血：金曜測定→土曜or翌週月曜報告。
          外来でTDMを行う場合は薬剤部担当者へ連絡し、採血コメントに「外注採血あり」を入力する（VRCZの検査オーダーは行わない）。
        </div>
      </Result>

      <div className="banner info">
        肥満患者では補正体重
        {adjustedBodyWeight(patient.weight, patient.height) != null &&
          `（AdjBW ${r1(adjustedBodyWeight(patient.weight, patient.height)!)}kg）`}
        を用いた投与設計を考慮します。副作用の視覚障害は一過性の場合が多いものの、血中濃度上昇と関連性が報告されています。
      </div>
      <p className="source-line">原典 p.36</p>
    </div>
  );
}

/* ---------------- entry ---------------- */

export const DESIGNERS: Record<string, { title: string; render: (p: PatientState) => JSX.Element }> = {
  vancomycin: { title: "バンコマイシン 投与設計", render: (p) => <VancomycinDesigner patient={p} /> },
  teicoplanin: { title: "テイコプラニン 投与設計", render: (p) => <TeicoplaninDesigner patient={p} /> },
  aminoglycoside: { title: "アミノグリコシド 投与設計", render: (p) => <AminoglycosideDesigner patient={p} /> },
  voriconazole: { title: "ボリコナゾール 投与設計", render: (p) => <VoriconazoleDesigner patient={p} /> },
};

export function Designer({ designerKey, patient }: { designerKey: string; patient: PatientState }) {
  const d = DESIGNERS[designerKey];
  if (!d) return <p className="empty">投与設計ツールが見つかりません。</p>;
  return (
    <div>
      <div className="detail-head">
        <h2>{d.title}</h2>
        <p className="en">原典に記載された表・式のみを実装しています（独自の薬物動態推定は行いません）</p>
      </div>
      {d.render(patient)}
    </div>
  );
}
