/**
 * 「一致した根拠」テーブルの項目（分類条件のフィールド名）を人間語ラベルへ写像する純関数。
 *
 * `eventName` 等の機械フィールド名だけでは「何のパラメータか」が読めないため、
 * 引用チップの出所ラベル（citationGroups の CITATION_KIND_LABEL）と同じ語彙で
 * 「受信イベント名」等を主表示にする。生フィールド名は副表示として残す（正直さ＋
 * スキーマの学習性）。ラベルは検出層のカラム名を捏造せず、照合対象が
 * 受信イベント（ingest 境界）のフィールドであることを表す。
 *
 * フィールドの語彙は分類 Rule が決定論で出すものに限る（LLM 非依存）:
 * - eventName   … KnownPatternRule / SimilarPatternRule（受信イベント名の一致）
 * - similarity  … SimilarPatternRule（過去事例との類似度スコア）
 * - payload.<k> … KnownPatternRule（受信ペイロードの条件一致）
 */

export type ConditionFieldDescription = {
  /** 人間語の主表示（例: 「受信イベント名」）。未知フィールドは生の名前をそのまま返す。 */
  readonly label: string;
  /** 生フィールド名の副表示。label と同じ（＝訳せなかった）場合は undefined＝副表示なし。 */
  readonly raw?: string;
};

const FIELD_LABELS: Record<string, string> = {
  eventName: "受信イベント名",
  similarity: "類似度スコア",
};

const PAYLOAD_PREFIX = "payload.";

export function describeConditionField(field: string): ConditionFieldDescription {
  const known = FIELD_LABELS[field];
  if (known) return { label: known, raw: field };
  if (field.startsWith(PAYLOAD_PREFIX)) {
    const key = field.slice(PAYLOAD_PREFIX.length);
    return { label: `受信ペイロード ${key}`, raw: field };
  }
  return { label: field };
}
