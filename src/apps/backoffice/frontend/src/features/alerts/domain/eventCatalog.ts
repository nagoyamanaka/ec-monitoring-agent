import catalog from "../config/eventCatalog.json";

/**
 * eventName（機械イベント名）→ 人間語の情報（タイトル＋説明）。
 * 機械名だけでは作業者に伝わらないため、行の主役タイトル・ドロワーの説明に使う。
 * 定義は config/eventCatalog.json に外出し（差し替え・データ移行が容易）。
 * 未登録の eventName は null（呼び出し側は eventName をそのままタイトルにフォールバック）。
 */

export type EventInfo = {
  readonly title: string;
  readonly description: string;
};

const CATALOG: Record<string, EventInfo> = catalog;

export function eventInfo(eventName: string): EventInfo | null {
  return CATALOG[eventName] ?? null;
}

/** 行の主役に出す人間語タイトル。未登録は eventName をそのまま返す。 */
export function eventTitle(eventName: string): string {
  return CATALOG[eventName]?.title ?? eventName;
}
