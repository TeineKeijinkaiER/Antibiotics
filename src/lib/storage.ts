/**
 * お気に入りと閲覧履歴（要件 FR-010-1 / FR-010-2）
 *
 * localStorage は private window・サイトデータのブロック・サムネイル生成などで
 * 読み書きの両方が例外を投げうるため、全ての呼び出しを try/catch で包み、
 * 保存できない環境でもアプリが正常に動くようにする。
 *
 * 保存するのは薬剤ID・菌IDのみ。患者条件（体重・Cr等）は一切保存しない（NFR-006）。
 */

const FAVORITES_KEY = "abx-navi/favorites/v1";
const HISTORY_KEY = "abx-navi/history/v1";
const DISCLAIMER_KEY = "abx-navi/disclaimer-acknowledged/v1";
const HISTORY_LIMIT = 10;

export type ItemKind = "drug" | "organism";
export type ItemRef = { kind: ItemKind; id: string };

function read(key: string): ItemRef[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is ItemRef =>
        x && (x.kind === "drug" || x.kind === "organism") && typeof x.id === "string",
    );
  } catch {
    return [];
  }
}

function write(key: string, items: ItemRef[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // 保存できない環境（プライベートウィンドウ等）では黙って諦める
  }
}

const same = (a: ItemRef, b: ItemRef) => a.kind === b.kind && a.id === b.id;

export const getFavorites = (): ItemRef[] => read(FAVORITES_KEY);

export function isFavorite(item: ItemRef): boolean {
  return getFavorites().some((f) => same(f, item));
}

/** お気に入りを付け外しし、変更後の一覧を返す */
export function toggleFavorite(item: ItemRef): ItemRef[] {
  const current = getFavorites();
  const next = current.some((f) => same(f, item))
    ? current.filter((f) => !same(f, item))
    : [item, ...current];
  write(FAVORITES_KEY, next);
  return next;
}

export const getHistory = (): ItemRef[] => read(HISTORY_KEY);

/** 直近に開いたものを先頭に置く。重複は繰り上げ、上限を超えた分は切り捨てる */
export function pushHistory(item: ItemRef): ItemRef[] {
  const next = [item, ...getHistory().filter((h) => !same(h, item))].slice(0, HISTORY_LIMIT);
  write(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* noop */
  }
}

/* ---------- 免責事項の確認（初回起動時に1度だけ） ---------- */

/**
 * 保存できない環境では毎回未確認として扱う。
 * 免責を読ませないまま使わせるより、毎回表示するほうが安全側に倒れる。
 */
export function hasAcknowledgedDisclaimer(): boolean {
  try {
    return localStorage.getItem(DISCLAIMER_KEY) === "1";
  } catch {
    return false;
  }
}

export function acknowledgeDisclaimer(): void {
  try {
    localStorage.setItem(DISCLAIMER_KEY, "1");
  } catch {
    /* noop */
  }
}
