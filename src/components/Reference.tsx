import { useState } from "react";
import { REFERENCE } from "../data";

/* ---------------- アナフィラキシー対応（要件 FR-009-2） ---------------- */

export function Anaphylaxis() {
  const a = REFERENCE.anaphylaxis;
  const [phase, setPhase] = useState<string>("中等症〜重症");
  const step = a.steps.find((s) => s.phase === phase);
  const common = a.steps.find((s) => s.phase === "共通");

  return (
    <div>
      <div className="detail-head">
        <h2>{a.title}</h2>
        <p className="en">原典 p.61-63</p>
      </div>

      <div className="banner danger">
        <b>まず当該抗菌薬の投与を直ちに中止し、バイタルサインと症状・程度をチェックする。</b>
      </div>

      <section className="section">
        <h3>重症度分類</h3>
        <div className="tabs">
          {a.steps
            .filter((s) => s.phase !== "共通")
            .map((s) => (
              <button
                key={s.phase}
                className="tab"
                aria-pressed={phase === s.phase}
                onClick={() => setPhase(s.phase)}
              >
                {s.phase}
              </button>
            ))}
        </div>
        {a.severity.map((s) => (
          <div className="dose-row" key={s.level}>
            <div className="dose-ind">{s.level}</div>
            <div className="dose-text">{s.definition}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <h3>救急処置（成人）— {phase}</h3>
        {common && (
          <ol className="notes" style={{ fontSize: 14 }}>
            {common.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ol>
        )}
        {step && (
          <ol className="notes" style={{ fontSize: 14, marginTop: 10 }} start={(common?.items.length ?? 0) + 1}>
            {step.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ol>
        )}
      </section>

      <section className="section">
        <h3>必要な薬剤</h3>
        <table className="doc">
          <colgroup>
            <col style={{ width: "32%" }} />
            <col style={{ width: "68%" }} />
          </colgroup>
          <tbody>
            {a.drugs.map((d) => (
              <tr key={d.name}>
                <td data-label="薬剤">
                  <b>{d.name}</b>
                </td>
                <td data-label="役割">{d.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section">
        <h3>発現予防のために行うこと</h3>
        <ul className="notes">
          {a.basicPrecautions.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
        <div className="dose-ind" style={{ marginTop: 12 }}>抗菌薬に関連するアレルギー歴がある場合</div>
        <ul className="notes">
          {a.allergyHistory.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h3>投与時の観察</h3>
        <ul className="notes">
          {a.observation.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
        <p className="source-line">原典 p.{a.source.pages.join(", ")}</p>
      </section>
    </div>
  );
}

/* ---------------- 曝露後予防投与（要件 FR-009-3） ---------------- */

export function PostExposureProphylaxis() {
  const p = REFERENCE.postExposureProphylaxis;
  return (
    <div>
      <div className="detail-head">
        <h2>{p.title}</h2>
        <p className="en">原典 p.58-59</p>
      </div>
      <div className="banner info">{p.intro}</div>

      {p.entries.map((e) => (
        <section className="section" key={e.id}>
          <h3>{e.disease}</h3>
          {e.regimens.map((r, i) => (
            <div className="dose-row" key={i}>
              <div className="dose-ind">{r.condition}</div>
              <div className="dose-text">{r.detail}</div>
            </div>
          ))}
        </section>
      ))}

      <div className="banner warn" style={{ marginTop: 20 }}>
        {p.notes.map((n, i) => (
          <div key={i}>{n}</div>
        ))}
      </div>
      <p className="source-line">原典 p.{p.source.pages.join(", ")}</p>
    </div>
  );
}

/* ---------------- 小児の体重・薬用量（要件 FR-009-4） ---------------- */

export function PediatricWeight() {
  const w = REFERENCE.pediatricWeight;
  return (
    <div>
      <div className="detail-head">
        <h2>{w.title}</h2>
        <p className="en">原典 p.45（参考）</p>
      </div>

      <section className="section">
        <h3>年齢別体重平均値</h3>
        <div className="scroll">
          <table className="abx">
            <thead>
              <tr>
                <th>年齢</th>
                <th>体重（平均）</th>
              </tr>
            </thead>
            <tbody>
              {w.table.map((r) => (
                <tr key={r.age}>
                  <td>{r.age}</td>
                  <td className="mono">{r.weight} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="source-line">{w.tableSource}</p>
      </section>

      <section className="section">
        <h3>小児における薬物量の算出</h3>
        {w.formulas.map((f) => (
          <div className="dose-row" key={f.name}>
            <div className="dose-ind">{f.name}</div>
            <div className="dose-text mono">{f.expression}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <h3>Von Harnack表（成人量に対する比）</h3>
        <div className="scroll">
          <table className="abx">
            <thead>
              <tr>
                {w.vonHarnack.map((v) => (
                  <th key={v.age}>{v.age}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {w.vonHarnack.map((v) => (
                  <td key={v.age} className="mono">
                    {v.ratio}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="banner warn">{w.caution}</div>
      <p className="source-line">原典 p.{w.source.pages.join(", ")}</p>
    </div>
  );
}

/* ---------------- ペニシリンG持続静注（要件 FR-005-5） ---------------- */

export function PcgContinuousInfusion() {
  const d = REFERENCE.pcgContinuousInfusion;
  const [daily, setDaily] = useState(d.regimens[0].dailyUnits);
  const regimen = d.regimens.find((r) => r.dailyUnits === daily)!;

  return (
    <div>
      <div className="detail-head">
        <h2>{d.title}</h2>
        <p className="en">原典 p.28-29</p>
      </div>

      <div className="banner danger">
        <b>持続投与の前に必ずローディングを行うこと。</b>
        {d.loading}
      </div>

      <div className="tabs">
        {d.regimens.map((r) => (
          <button
            key={r.dailyUnits}
            className="tab"
            aria-pressed={daily === r.dailyUnits}
            onClick={() => setDaily(r.dailyUnits)}
          >
            {r.dailyLabel}
          </button>
        ))}
      </div>

      {daily < 12000000 && (
        <div className="banner warn">1日の総投与量が1200万単位未満の場合は、間欠的な静注のほうが望ましい。</div>
      )}

      {regimen.routes.map((r) => (
        <div className="card" key={r.route} style={{ marginBottom: 12 }}>
          <div className="dose-ind">{r.route}からの投与</div>
          <div className="dose-text">{r.detail}</div>
          {(r.waterPerDay || r.concentration || r.potassium) && (
            <dl className="kv" style={{ marginTop: 8 }}>
              {r.waterPerDay && (
                <>
                  <dt>抗菌薬での1日水分量</dt>
                  <dd className="mono">{r.waterPerDay}</dd>
                </>
              )}
              {r.concentration && (
                <>
                  <dt>抗菌薬濃度</dt>
                  <dd className="mono">{r.concentration}</dd>
                </>
              )}
              {r.potassium && (
                <>
                  <dt>K濃度</dt>
                  <dd className="mono">{r.potassium}</dd>
                </>
              )}
            </dl>
          )}
          {r.route === "中心静脈" && (
            <div className="banner warn" style={{ marginTop: 10, marginBottom: 0 }}>
              中心静脈からの投与方法はK濃度が高くなるため、ICU症例などInを絞りたい場合にのみ考慮すること。
            </div>
          )}
        </div>
      ))}

      <section className="section">
        <h3>注意点</h3>
        <ul className="notes">
          {d.cautions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h3>背景</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>{d.rationale}</p>
        <p className="source-line">原典 p.{d.source.pages.join(", ")}</p>
      </section>
    </div>
  );
}

/* ---------------- AMR対策（要件 FR-009-5） ---------------- */

export function Amr() {
  const a = REFERENCE.amr;
  const b = REFERENCE.bibliography;

  return (
    <div>
      <div className="detail-head">
        <h2>{a.title}</h2>
        <p className="en">AMR（Antimicrobial resistance）対策 ／ 原典 p.75-76</p>
      </div>

      {a.sections.map((s) => (
        <section className="section" key={s.heading}>
          <h3>{s.heading}</h3>
          {s.paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: 13.5, color: "var(--ink-2)", margin: "0 0 10px" }}>
              {p}
            </p>
          ))}
        </section>
      ))}

      <section className="section">
        <h3>日本のAMRアクションプラン 成果指標</h3>
        <ul className="notes" style={{ fontSize: 14 }}>
          {a.targets.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <div className="banner info" style={{ marginTop: 10 }}>{a.targetsNote}</div>
      </section>

      <section className="section">
        <h3>『抗微生物薬適正使用の手引き』について</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>{a.guideNote}</p>
        <div className="dose-ind" style={{ marginTop: 14 }}>閲覧場所</div>
        <ul className="notes">
          {a.links.map((l) => (
            <li key={l.label}>
              {l.url ? (
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ) : (
                <b>{l.label}</b>
              )}
              {l.note && <> — {l.note}</>}
            </li>
          ))}
        </ul>
        <p className="source-line">原典 p.{a.source.pages.join(", ")}</p>
      </section>

      <section className="section">
        <h3>{b.title}</h3>
        <ol className="notes" style={{ fontSize: 12.5 }}>
          {b.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
        <p className="source-line">原典 p.{b.source.pages.join(", ")}</p>
      </section>
    </div>
  );
}

/* ---------------- 適正使用指針・AWaRe（要件 FR-009-5） ---------------- */

export function Stewardship() {
  const s = REFERENCE.stewardship;
  const a = REFERENCE.aware;

  return (
    <div>
      <div className="detail-head">
        <h2>{s.title}・AWaRe分類</h2>
        <p className="en">原典 p.7-8, 74</p>
      </div>

      <section className="section">
        <h3>当院が考慮すべき目的</h3>
        <ol className="notes" style={{ fontSize: 14 }}>
          {s.objectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ol>
      </section>

      {s.sections.map((sec) => (
        <section className="section" key={sec.heading}>
          <h3>{sec.heading}</h3>
          <ul className="notes">
            {sec.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="section">
        <h3>{s.applicationRule.heading}</h3>
        <div className="badges" style={{ marginBottom: 10 }}>
          {s.applicationRule.drugs.map((d) => (
            <span className="badge app" key={d}>
              {d}
            </span>
          ))}
        </div>
        <ul className="notes">
          {s.applicationRule.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
        <p className="source-line">原典 p.{s.source.pages.join(", ")}</p>
      </section>

      <section className="section">
        <h3>{a.title}</h3>
        <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 0 }}>{a.intro}</p>
        {a.groups.map((g) => (
          <div className="dose-row" key={g.category}>
            <div className="dose-ind">{g.category}</div>
            <table className="doc">
              <colgroup>
                <col style={{ width: "45%" }} />
                <col style={{ width: "55%" }} />
              </colgroup>
              <tbody>
                {g.drugs.map((d) => (
                  <tr key={d.generic}>
                    <td className="mono" data-label="一般名">{d.generic}</td>
                    <td data-label="商品名">{d.brand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="source-line">原典 p.{a.source.pages.join(", ")}</p>
      </section>
    </div>
  );
}
