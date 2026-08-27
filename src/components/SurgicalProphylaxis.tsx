import { useState } from "react";
import type { PatientState } from "../types";
import { PROPHYLAXIS } from "../data";
import { convertPerKg } from "../lib/calc";

/** 体重帯から該当する1回投与量を選ぶ（要件 FR-008-3） */
function bandForWeight(
  bands: { weightMin: number | null; weightMax: number | null }[],
  weight: number | null,
) {
  if (weight == null) return null;
  return (
    bands.find(
      (b) =>
        (b.weightMin == null || weight >= b.weightMin) &&
        (b.weightMax == null || weight < b.weightMax),
    ) ?? null
  );
}

function bandLabel(b: { weightMin: number | null; weightMax: number | null }) {
  if (b.weightMin == null && b.weightMax == null) return "体重によらず";
  if (b.weightMin == null) return `< ${b.weightMax}kg`;
  if (b.weightMax == null) return `≧ ${b.weightMin}kg`;
  return `${b.weightMin}–${b.weightMax}kg`;
}

export function SurgicalProphylaxis({
  patient,
  onOpenDrug,
}: {
  patient: PatientState;
  onOpenDrug: (id: string) => void;
}) {
  const [group, setGroup] = useState<1 | 2 | 3 | null>(null);
  const [allergy, setAllergy] = useState(false);

  const entries = group
    ? PROPHYLAXIS.entries.filter((e) => e.targetGroup === group)
    : PROPHYLAXIS.entries;

  return (
    <div>
      <div className="detail-head">
        <h2>周術期予防抗菌薬</h2>
        <p className="en">原典 p.47-50</p>
      </div>

      <div className="banner info">
        {PROPHYLAXIS.meta.purpose.map((p, i) => (
          <div key={i}>{p}</div>
        ))}
      </div>

      {/* ---- 領域から引く ---- */}
      <section className="section">
        <h3>手術別 予防抗菌薬の選択</h3>
        <div className="tabs">
          <button className="tab" aria-pressed={group === null} onClick={() => setGroup(null)}>
            すべて
          </button>
          {([1, 2, 3] as const).map((g) => (
            <button key={g} className="tab" aria-pressed={group === g} onClick={() => setGroup(g)}>
              分類 {g}
            </button>
          ))}
        </div>

        {group && (
          <p className="dose-note" style={{ marginBottom: 10 }}>
            {PROPHYLAXIS.targetGroupLabels[String(group)]}
          </p>
        )}

        <table className="doc">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "40%" }} />
            <col style={{ width: "38%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>領域</th>
              <th>臓器</th>
              <th>主な予防抗菌薬</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td data-label="領域">{e.field}</td>
                <td data-label="臓器">{e.organs.join("、")}</td>
                <td data-label="主な予防抗菌薬">
                  <b>{e.recommended.join("、")}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---- 1回投与量（体重帯で自動選択） ---- */}
      <section className="section">
        <h3>予防抗菌薬 1回投与量</h3>
        {patient.weight == null && (
          <p className="dose-note" style={{ marginBottom: 8 }}>
            患者条件パネルで体重を入力すると、該当する体重帯を自動でハイライトします。
          </p>
        )}
        {PROPHYLAXIS.doses.map((d) => {
          const active = bandForWeight(d.bands, patient.weight);
          return (
            <div className="dose-row" key={d.drug}>
              <div className="dose-text">
                <button
                  className="link-btn"
                  style={{ fontSize: 15, fontWeight: 700 }}
                  onClick={() => onOpenDrug(d.drugId)}
                >
                  {d.drug}
                </button>
              </div>
              <div className="renal-grid">
                {d.bands.map((b, i) => {
                  const isActive = active === b;
                  const conv = b.perKg ? convertPerKg(b.perKg, patient) : null;
                  return (
                    <div
                      key={i}
                      className={
                        "renal-row " +
                        (patient.weight == null ? "" : isActive ? "active" : "dim")
                      }
                    >
                      <div className="band">{bandLabel(b)}</div>
                      <div>
                        {b.text}
                        {conv && <span className="mono">　→ {conv.text}{conv.clipped && "（上限）"}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <p className="source-line">原典 p.50</p>
      </section>

      {/* ---- β-ラクタムアレルギー ---- */}
      <section className="section">
        <h3>β-ラクタム薬アレルギーがある場合の選択</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <input type="checkbox" checked={allergy} onChange={(e) => setAllergy(e.target.checked)} />
          <span>β-ラクタムアレルギーあり</span>
        </label>
        {allergy ? (
          <table className="doc">
            <colgroup>
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>創分類</th>
                <th>グラム陽性菌</th>
                <th>グラム陰性菌</th>
                <th>嫌気性菌</th>
              </tr>
            </thead>
            <tbody>
              {PROPHYLAXIS.betaLactamAllergy.map((r) => (
                <tr key={r.id}>
                  <td data-label="創分類">{r.woundClass}</td>
                  <td data-label="グラム陽性菌">{r.gramPositive.join("、") || "—"}</td>
                  <td data-label="グラム陰性菌">{r.gramNegative.join("、") || "—"}</td>
                  <td data-label="嫌気性菌">{r.anaerobe.join("、") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="dose-note">チェックすると代替薬の一覧を表示します。</p>
        )}
        <p className="source-line">原典 p.49</p>
      </section>

      {/* ---- タイミング・期間 ---- */}
      <section className="section">
        <h3>投与タイミング・術中追加投与</h3>
        <ul className="notes">
          {PROPHYLAXIS.timing.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="source-line">原典 p.49</p>
      </section>

      <section className="section">
        <h3>投与期間</h3>
        <ul className="notes">
          {PROPHYLAXIS.duration.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <p className="source-line">原典 p.50</p>
      </section>

      {/* ---- 創分類 ---- */}
      <section className="section">
        <h3>手術創分類と予防的抗菌薬の適応</h3>
        {PROPHYLAXIS.woundClasses.map((w) => (
          <div className="dose-row" key={w.id}>
            <div className="dose-ind">{w.label}</div>
            <div className="dose-text">{w.indication}</div>
            <div className="dose-note">{w.criteria}</div>
          </div>
        ))}
        <p className="source-line">原典 p.47-48</p>
      </section>

      <section className="section">
        <h3>予防抗菌薬選択の基準</h3>
        <ul className="notes">
          {PROPHYLAXIS.meta.selectionPrinciples.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
        <p className="source-line">原典 p.48</p>
      </section>
    </div>
  );
}
