import { useMemo, useState } from "react";
import {
  INFECTIONS,
  INFECTION_BY_ID,
  DRUG_BY_ID,
  ORGANISM_BY_ID,
  STEWARDSHIP_TOPICS,
  STEWARDSHIP_GUIDE,
} from "../data";
import {
  INFECTION_CATEGORY_LABEL,
  type InfectionCategory,
  type InfectionEntry,
  type InfectionTable,
  type PatientMode,
} from "../types";
import { normalize } from "../lib/normalize";

/**
 * 感染症別レーン（FR-017）
 *
 * 出典: 厚生労働省『抗微生物薬適正使用の手引き 第四版』医科・外来編／医科・入院編。
 *
 * 原典は外来編＝疾患別、入院編＝総論と構造が異なるが、その違いは画面に持ち込まない。
 * 感染症名を主キーとして、両編に散らばった記載をこの画面で束ねる（FR-017-2, FR-100-5）。
 */

/** カテゴリの表示順。診療で引く頻度の高いものから並べる */
const CATEGORY_ORDER: InfectionCategory[] = [
  "airway",
  "pneumonia",
  "urinary",
  "skin_soft_tissue",
  "bloodstream",
];

function inMode(entry: InfectionEntry, mode: PatientMode): boolean {
  return entry.populations.includes(mode);
}

function searchInfections(query: string, mode: PatientMode): InfectionEntry[] {
  const q = normalize(query);
  if (!q) return [];
  return INFECTIONS.filter((e) => {
    if (!inMode(e, mode)) return false;
    const hay = [e.name, ...e.aliases, e.summary].map(normalize);
    return hay.some((h) => h.includes(q));
  });
}

/* ---------------- 入口（検索欄＋カテゴリ） ---------------- */

export function InfectionPicker({
  mode,
  onPickCategory,
  onOpenInfection,
}: {
  mode: PatientMode;
  onPickCategory: (category: InfectionCategory) => void;
  onOpenInfection: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchInfections(query, mode), [query, mode]);

  const counts = useMemo(() => {
    const m = new Map<InfectionCategory, number>();
    for (const e of INFECTIONS) {
      if (!inMode(e, mode)) continue;
      m.set(e.category, (m.get(e.category) ?? 0) + 1);
    }
    return m;
  }, [mode]);

  return (
    <>
      <div className="searchbox">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="感染症名を入力（肺炎・尿路感染・かぜ など）"
          aria-label="感染症名を入力"
        />
      </div>

      {query ? (
        <div className="list">
          {results.map((e) => (
            <InfectionCard key={e.id} entry={e} onOpen={() => onOpenInfection(e.id)} />
          ))}
          {results.length === 0 && (
            <p className="empty">「{query}」に一致する感染症はありません。</p>
          )}
        </div>
      ) : (
        <>
          <p className="lane-intro">
            厚生労働省『{STEWARDSHIP_GUIDE.title} {STEWARDSHIP_GUIDE.edition}』の記載を、
            感染症ごとにまとめています。抗菌薬名から当院の薬剤ページへ移動できます。
          </p>

          <div className="top-grid">
            {CATEGORY_ORDER.filter((c) => (counts.get(c) ?? 0) > 0).map((c) => (
              <button
                key={c}
                className="top-btn compact"
                onClick={() => onPickCategory(c)}
              >
                {INFECTION_CATEGORY_LABEL[c]}
                <span className="top-btn-count">{counts.get(c)}</span>
              </button>
            ))}
          </div>

          <div className="sub-actions">
            <p className="dose-note">
              手引きの重要な表（治療期間の早見表・血液培養の解釈・経口薬への切り替えなど）は、
              ホームの「その他」→「適正使用の手引き（表集）」にまとめています。
            </p>
          </div>
        </>
      )}
    </>
  );
}

/* ---------------- カテゴリ内の感染症一覧 ---------------- */

export function InfectionList({
  category,
  mode,
  onOpen,
}: {
  category: InfectionCategory;
  mode: PatientMode;
  onOpen: (id: string) => void;
}) {
  const entries = useMemo(
    () => INFECTIONS.filter((e) => e.category === category && inMode(e, mode)),
    [category, mode],
  );

  if (entries.length === 0) {
    return <p className="empty">この区分に{mode === "adult" ? "成人" : "小児"}向けの記載はありません。</p>;
  }

  return (
    <div className="list">
      {entries.map((e) => (
        <InfectionCard key={e.id} entry={e} onOpen={() => onOpen(e.id)} />
      ))}
    </div>
  );
}

/** 一覧に出すカード。結論を1行で見せる */
function InfectionCard({ entry, onOpen }: { entry: InfectionEntry; onOpen: () => void }) {
  return (
    <button className="result" onClick={onOpen}>
      <div className="result-head">
        <span className="result-name">{entry.name}</span>
        <StanceBadge entry={entry} />
      </div>
      <p className="result-dose">{entry.verdict ?? entry.summary}</p>
    </button>
  );
}

function StanceBadge({ entry }: { entry: InfectionEntry }) {
  const label =
    entry.stance === "withhold"
      ? "抗菌薬を出さない"
      : entry.stance === "conditional"
        ? "条件つきで出す"
        : entry.stance === "test_first"
          ? "検査で決める"
          : "手引きに推奨薬の記載なし";
  return <span className={`badge stance-${entry.stance}`}>{label}</span>;
}

/* ---------------- 感染症詳細 ---------------- */

export function InfectionDetail({
  id,
  mode,
  onOpenDrug,
  onOpenOrganism,
  onOpenTopics,
}: {
  id: string;
  mode: PatientMode;
  onOpenDrug: (drugId: string) => void;
  onOpenOrganism: (organismId: string) => void;
  onOpenTopics: () => void;
}) {
  const entry = INFECTION_BY_ID.get(id);
  if (!entry) return <p className="empty">感染症が見つかりません。</p>;

  const bookLabel = STEWARDSHIP_GUIDE.books[entry.source.book];

  /**
   * 選択中の集団のものだけを出す（FR-000-7）。
   * 成人と小児の用量を同一画面に並べると誤参照の原因になる。
   */
  const forMode = <T extends { population?: PatientMode }>(items: T[] | undefined) =>
    (items ?? []).filter((x) => !x.population || x.population === mode);

  const shownDrugs = forMode(entry.drugs);
  const shownTables = forMode(entry.tables);

  return (
    <>
      <div className="detail-head">
        <h2>{entry.name}</h2>
        <StanceBadge entry={entry} />
      </div>
      <p className="lane-intro">{entry.summary}</p>

      {!entry.populations.includes(mode) && (
        <div className="banner warn">
          この感染症について、手引きに{mode === "adult" ? "成人" : "小児"}向けの記載はありません。
        </div>
      )}

      {/* 結論。抗菌薬を出さない推奨も同じ大きさで見せる（FR-017-6） */}
      {entry.verdict && (
        <div className={`verdict verdict-${entry.stance}`}>
          {entry.verdict}
          {entry.verdictNote && <small>{entry.verdictNote}</small>}
        </div>
      )}

      {entry.noRegimenNote && (
        <section className="section">
          <h3>経験的治療について</h3>
          <p className="dose-note">{entry.noRegimenNote}</p>
        </section>
      )}

      {shownDrugs.length > 0 && (
        <section className="section">
          <h3>推奨される抗菌薬</h3>
          <div className="list">
            {shownDrugs.map((d, i) => {
              const drug = d.drugId ? DRUG_BY_ID.get(d.drugId) : undefined;
              return (
                <div className="dose-card" key={`${d.drugId ?? d.label}-${i}`}>
                  {drug ? (
                    <button
                      className="link-btn rx-link"
                      onClick={() => onOpenDrug(drug.id)}
                      aria-label={`${drug.genericName.ja}の薬剤画面を開く`}
                    >
                      {drug.genericName.ja} →
                    </button>
                  ) : (
                    /* 当院採用のない薬剤はリンクを張らない（FR-017-5） */
                    <span className="rx-plain">{d.label}</span>
                  )}
                  {d.dosage && <p className="dose-text">{d.dosage}</p>}
                  {d.duration && (
                    <p className="dose-text">
                      投与期間：<b>{d.duration}</b>
                    </p>
                  )}
                  {d.note && <p className="dose-note">{d.note}</p>}
                </div>
              );
            })}
          </div>
          <p className="dose-note">
            用量・当院の採用状況・使用申請のルールは薬剤ページを正とします（FR-017-8）。
          </p>
        </section>
      )}

      {(entry.likelyOrganismIds?.length || entry.organismLabels?.length) && (
        <section className="section">
          <h3>想定される主な原因微生物</h3>
          <div className="chip-row">
            {entry.likelyOrganismIds?.map((oid) => {
              const org = ORGANISM_BY_ID.get(oid);
              if (!org) return null;
              return (
                <button
                  key={oid}
                  className="chip chip-link"
                  onClick={() => onOpenOrganism(oid)}
                  aria-label={`${org.japaneseName}の菌種画面を開く`}
                >
                  {org.japaneseName} →
                </button>
              );
            })}
            {entry.organismLabels?.map((label) => (
              <span key={label} className="chip">
                {label}
              </span>
            ))}
          </div>
          {entry.organismNote && <p className="dose-note">{entry.organismNote}</p>}
        </section>
      )}

      {entry.duration && entry.duration.length > 0 && (
        <section className="section">
          <h3>治療期間</h3>
          <div className="scroll">
            <table className="doc">
              <thead>
                <tr>
                  <th>病態</th>
                  <th>短期治療期間</th>
                  <th>長期治療期間（参考）</th>
                </tr>
              </thead>
              <tbody>
                {entry.duration.map((d) => (
                  <tr key={d.condition}>
                    <td>{d.condition}</td>
                    <td>
                      <b>{d.short}</b>
                    </td>
                    <td>{d.long ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {entry.redFlags && (
        <section className="section">
          <div className="callout danger">
            <h3>{entry.redFlags.heading}</h3>
            <ul>
              {entry.redFlags.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            {entry.redFlags.note && <p>{entry.redFlags.note}</p>}
          </div>
        </section>
      )}

      {shownTables.map((t) => (
        <DataTable key={t.caption} table={t} />
      ))}

      {/*
        判断に効く数値は必ず残す（FR-100-4）が、処方を決める段では読まない。
        30秒で結論に届くよう畳んでおき、患者に説明するときに開く（FR-100-2）。
      */}
      {entry.figures && entry.figures.length > 0 && (
        <section className="section">
          <details className="fold">
            <summary>判断の根拠となる数値（{entry.figures.length}件）</summary>
            <dl className="figures">
              {entry.figures.map((f) => (
                <div className="figure" key={f.value + f.text}>
                  <dt>{f.value}</dt>
                  <dd>{f.text}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
      )}

      {entry.sections?.map((s) => (
        <section className="section" key={s.heading}>
          <h3>{s.heading}</h3>
          {s.body && <p className="dose-text">{s.body}</p>}
          {s.items && (
            <ul className="bullets">
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          )}
          {s.cite && <p className="source-line">{s.cite}</p>}
        </section>
      ))}

      {entry.offLabelNote && shownDrugs.length > 0 && (
        <section className="section">
          <div className="callout warn">
            <h3>適応外使用</h3>
            <p>{entry.offLabelNote}</p>
          </div>
        </section>
      )}

      <div className="sub-actions">
        <button className="sub-btn" onClick={onOpenTopics}>
          適正使用の手引き（表集）→
        </button>
      </div>

      <p className="source-line">
        出典：厚生労働省『{STEWARDSHIP_GUIDE.title} {STEWARDSHIP_GUIDE.edition}』{bookLabel} p.
        {entry.source.pages.join(", ")} の要約。個々の患者の治療方針を示すものではありません。
      </p>
    </>
  );
}

/* ---------------- 「その他」に置く表集 ---------------- */

export function StewardshipTopics({ onOpenTopic }: { onOpenTopic: (id: string) => void }) {
  return (
    <>
      <div className="detail-head">
        <h2>適正使用の手引き（表集）</h2>
      </div>
      <p className="lane-intro">
        厚生労働省『{STEWARDSHIP_GUIDE.title} {STEWARDSHIP_GUIDE.edition}』のうち、
        個々の感染症ページに載りきらない横断的な表をまとめています。
      </p>
      <div className="top-grid">
        {STEWARDSHIP_TOPICS.map((t) => (
          <button key={t.id} className="top-btn compact" onClick={() => onOpenTopic(t.id)}>
            {t.title}
          </button>
        ))}
      </div>
    </>
  );
}

export function StewardshipTopicDetail({ id }: { id: string }) {
  const topic = STEWARDSHIP_TOPICS.find((t) => t.id === id);
  if (!topic) return <p className="empty">項目が見つかりません。</p>;

  return (
    <>
      <div className="detail-head">
        <h2>{topic.title}</h2>
      </div>
      {topic.intro && <p className="lane-intro">{topic.intro}</p>}

      {topic.tables?.map((t) => <DataTable key={t.caption} table={t} />)}

      {topic.sections?.map((s) => (
        <section className="section" key={s.heading}>
          <h3>{s.heading}</h3>
          {s.body && <p className="dose-text">{s.body}</p>}
          {s.items && (
            <ul className="bullets">
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="source-line">
        出典：厚生労働省『{STEWARDSHIP_GUIDE.title} {STEWARDSHIP_GUIDE.edition}』
        {STEWARDSHIP_GUIDE.books[topic.source.book]} p.{topic.source.pages.join(", ")}
      </p>
    </>
  );
}

/* ---------------- 共通：原典の表 ---------------- */

/** 原典で表になっていた記載は構造を保ったまま出す（FR-017-4） */
function DataTable({ table }: { table: InfectionTable }) {
  const singleColumn = table.headers.length === 1;
  return (
    <section className="section">
      <h3>{table.caption}</h3>
      {singleColumn ? (
        <ul className="bullets">
          {table.rows.map((r) => (
            <li key={r[0]}>{r[0]}</li>
          ))}
        </ul>
      ) : (
        <div className="scroll">
          <table className="doc">
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={`${r[0]}-${i}`}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {table.note && <p className="dose-note">{table.note}</p>}
    </section>
  );
}
