import { useState } from "react";
import type { Organism, AntibiogramSetting } from "../types";
import { ANTIBIOGRAM, ORGANISM_BY_ID } from "../data";

/** 感受性率の3段階（原典 p.70 凡例） */
function tier(pct: number): "good" | "warn" | "bad" {
  if (pct >= 80) return "good";
  if (pct >= 50) return "warn";
  return "bad";
}

/** 検出株数がこれ未満なら解釈に注意を促す（要件 FR-007-4） */
const LOW_ISOLATE_THRESHOLD = 30;

export function AntibiogramNotice() {
  const { verified, verifiedOn } = ANTIBIOGRAM.meta;
  if (!verified) {
    return (
      <div className="banner warn">
        <b>このアンチバイオグラムは検証待ちです。</b>
        {ANTIBIOGRAM.meta.verificationNote}
      </div>
    );
  }
  if (!verifiedOn) return null;
  return (
    <p className="source-line">
      原本照合済み（{verifiedOn} 感染制御管理室）
    </p>
  );
}

export function OrganismDetail({ organism }: { organism: Organism }) {
  const [setting, setSetting] = useState<AntibiogramSetting>("inpatient");

  const row = ANTIBIOGRAM.rows.find(
    (r) => r.organismId === organism.id && r.setting === setting,
  );
  const columns =
    organism.gramStain === "gram_positive_coccus"
      ? ANTIBIOGRAM.meta.gpcColumns
      : ANTIBIOGRAM.meta.gnrColumns;

  return (
    <div>
      <div className="detail-head">
        <h2>{organism.japaneseName}</h2>
        <p className="en">
          {organism.scientificName}
          {organism.group && ` ／ ${organism.group}`}
        </p>
      </div>

      <AntibiogramNotice />

      <div className="tabs">
        <button
          className="tab"
          aria-pressed={setting === "inpatient"}
          onClick={() => setSetting("inpatient")}
        >
          入院
        </button>
        <button
          className="tab"
          aria-pressed={setting === "outpatient"}
          onClick={() => setSetting("outpatient")}
        >
          外来
        </button>
      </div>

      {!row ? (
        <p className="empty">この菌の{setting === "inpatient" ? "入院" : "外来"}データは原典にありません。</p>
      ) : (
        <>
          <div className="badges" style={{ marginBottom: 12 }}>
            <span className="badge neutral">
              検出株数 {row.isolates} 株
            </span>
            {row.annotations?.map((a, i) => (
              <span className="badge aware" key={i}>
                {a}
              </span>
            ))}
          </div>

          {row.isolates > 0 && row.isolates < LOW_ISOLATE_THRESHOLD && (
            <div className="banner warn">
              検出株数が {row.isolates} 株と少ないため、感性率の解釈には注意が必要です。
            </div>
          )}

          {row.isolates === 0 ? (
            <p className="empty">この期間の検出株がありません（0株）。</p>
          ) : (
            <div className="scroll">
              <table className="abx">
                <thead>
                  <tr>
                    <th>抗菌薬</th>
                    <th>感性率（S）</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((abx) => {
                    const pct = row.susceptibility[abx];
                    return (
                      <tr key={abx}>
                        <td className="mono">{abx}</td>
                        <td className="pct">
                          {pct == null ? (
                            <span className="tierpill tier-na">—</span>
                          ) : (
                            <span className={`tierpill tier-${tier(pct)}`}>{pct}%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="legend">
            <span className="tierpill tier-good">80–100%</span>
            <span className="tierpill tier-warn">50–80%</span>
            <span className="tierpill tier-bad">0–50%</span>
            <span className="tierpill tier-na">データなし</span>
          </div>

          <div className="banner info" style={{ marginTop: 16 }}>
            経験的治療においては一般に<b>最低80%の感性率</b>が必要とされるが、感染臓器や重症度によっては
            90%あるいは100%の感性率が必要とされる場合もある（原典 p.72）。
          </div>

          <p className="source-line">
            {ANTIBIOGRAM.meta.facility}　{ANTIBIOGRAM.meta.year}（{ANTIBIOGRAM.meta.period}）
            ／ {ANTIBIOGRAM.meta.note}
            ／ 原典 p.{row.source.pages.join(", ")}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * 抗菌薬側からの逆引き（要件 FR-007-7）。
 * 指定した抗菌薬略号の感性率が高い順に菌を並べる。
 */
export function ReverseLookup({
  abx,
  setting,
  onSelect,
}: {
  abx: string;
  setting: AntibiogramSetting;
  onSelect: (organismId: string) => void;
}) {
  const rows = ANTIBIOGRAM.rows
    .filter((r) => r.setting === setting && r.susceptibility[abx] != null && r.isolates > 0)
    .sort((a, b) => b.susceptibility[abx] - a.susceptibility[abx]);

  if (rows.length === 0) {
    return <p className="empty">{abx} の感受性データがありません。</p>;
  }

  return (
    <div className="scroll">
      <table className="abx">
        <thead>
          <tr>
            <th>菌名</th>
            <th>株数</th>
            <th>{abx} 感性率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const org = ORGANISM_BY_ID.get(r.organismId);
            const pct = r.susceptibility[abx];
            return (
              <tr key={r.organismId}>
                <td>
                  <button className="link-btn" onClick={() => onSelect(r.organismId)}>
                    {org?.japaneseName ?? r.organismId}
                  </button>
                </td>
                <td className="mono">{r.isolates}</td>
                <td className="pct">
                  <span className={`tierpill tier-${tier(pct)}`}>{pct}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
