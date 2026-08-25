import { useMemo, useState } from "react";
import { DRUGS } from "../data";
import { normalize } from "../lib/normalize";

/**
 * 当院採用注射抗菌薬一覧（要件 FR-009-1 / 原典 p.65-68）
 * 薬剤マスタの formulations から導出する。専用のデータは持たない。
 */
export function Formulary({ onOpenDrug }: { onOpenDrug: (id: string) => void }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const all = DRUGS.flatMap((drug) =>
      (drug.formulations ?? []).map((f) => ({ drug, formulation: f })),
    );
    const q = normalize(query);
    if (!q) return all;
    return all.filter(({ drug, formulation }) =>
      [
        drug.genericName.ja,
        drug.genericName.en,
        drug.abbr ?? "",
        drug.class,
        formulation.brandName,
      ].some((s) => normalize(s).includes(q)),
    );
  }, [query]);

  const byClass = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = map.get(row.drug.class) ?? [];
      list.push(row);
      map.set(row.drug.class, list);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <div>
      <div className="detail-head">
        <h2>当院採用注射抗菌薬一覧</h2>
        <p className="en">2026年4月1日現在 ／ 原典 p.65-68</p>
      </div>

      <div className="searchbox">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="商品名・一般名・略語・系統で絞り込み"
          aria-label="採用薬を絞り込み"
        />
      </div>

      {rows.length === 0 ? (
        <p className="empty">該当する採用薬はありません。</p>
      ) : (
        byClass.map(([className, list]) => (
          <section className="section" key={className}>
            <h3>{className}</h3>
            <div className="scroll">
              <table className="abx">
                <thead>
                  <tr>
                    <th>商品名</th>
                    <th>略語</th>
                    <th>規格</th>
                    <th>薬価</th>
                    <th>静注</th>
                    <th>点滴静注</th>
                    <th>筋注</th>
                    <th>申請書</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(({ drug, formulation: f }) => (
                    <tr key={f.brandName}>
                      <td style={{ whiteSpace: "normal", minWidth: 180 }}>
                        <button className="link-btn" onClick={() => onOpenDrug(drug.id)}>
                          {f.brandName}
                        </button>
                      </td>
                      <td className="mono">{drug.abbr ?? "—"}</td>
                      <td className="mono">{f.strength}</td>
                      <td className="mono">{f.price != null ? f.price.toLocaleString() : "—"}</td>
                      <td>{f.ivPush ? "○" : "×"}</td>
                      <td>{f.drip === false ? "×" : f.drip}</td>
                      <td>{f.im ? "○" : "×"}</td>
                      <td>{drug.requiresApplication ? "○" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.some(({ formulation }) => formulation.notes?.length) && (
              <ul className="notes">
                {list.flatMap(({ formulation }) =>
                  (formulation.notes ?? []).map((n, i) => (
                    <li key={`${formulation.brandName}-${i}`}>
                      <b>{formulation.brandName}</b>：{n}
                    </li>
                  )),
                )}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
