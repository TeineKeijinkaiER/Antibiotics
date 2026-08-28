import { useState } from "react";

/**
 * オープニング画面（大項目5ボタン）
 *
 * ボタンには説明文を置かない。名前だけで選べるものにする。
 * 「アプリの説明」はヘッダー（欄外）に小さく置くため、ここには含めない。
 */

export type TopCategory = "oral" | "injectable" | "infection" | "organism" | "other";

export const TOP_CATEGORIES: { key: TopCategory; label: string }[] = [
  { key: "oral", label: "内服薬" },
  { key: "injectable", label: "注射薬" },
  { key: "infection", label: "感染症別" },
  { key: "organism", label: "菌種別" },
  { key: "other", label: "その他" },
];

export const APP_TITLE = "TKH抗菌薬投与マニュアル";
export const APP_EDITION = "9th edition";

/**
 * 表紙のイラスト。
 * public/opening.jpg があればそれを使い、無ければ同梱の opening.svg にフォールバックする。
 * （写真を差し替えたいときは public/opening.jpg を置くだけでよい）
 */
function OpeningArt() {
  const [src, setSrc] = useState("./opening.jpg");
  return (
    <img
      className="opening-art"
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setSrc("./opening.svg")}
    />
  );
}

export function Opening({ onPick }: { onPick: (key: TopCategory) => void }) {
  return (
    <div className="opening">
      <header className="opening-head">
        <h1>{APP_TITLE}</h1>
        <p className="opening-edition">{APP_EDITION}</p>
      </header>

      <OpeningArt />

      <nav className="top-grid">
        {TOP_CATEGORIES.map((c) => (
          <button key={c.key} className="top-btn" onClick={() => onPick(c.key)}>
            {c.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------- 「その他」の中身 ---------------- */

export type OtherKey =
  | "prophylaxis"
  | "postexposure"
  | "pediatric-weight"
  | "amr"
  | "stewardship-topics";

export const OTHER_ITEMS: { key: OtherKey; label: string }[] = [
  { key: "prophylaxis", label: "周術期" },
  { key: "postexposure", label: "暴露後予防投与" },
  { key: "pediatric-weight", label: "小児体重服用量簡易表" },
  { key: "amr", label: "AMR対策" },
  // 感染症別の各ページに載りきらない、適正使用の手引きの重要な表をまとめる（FR-017 補足）
  { key: "stewardship-topics", label: "適正使用の手引き（表集）" },
];

export function OtherMenu({ onPick }: { onPick: (key: OtherKey) => void }) {
  return (
    <div className="top-grid">
      {OTHER_ITEMS.map((c) => (
        <button key={c.key} className="top-btn" onClick={() => onPick(c.key)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
