import type { MatchedConditionView } from "./AlertView";
import { describeConditionField } from "./conditionFieldLabel";

/**
 * 「一致した根拠」テーブルの表示射影（純関数・I/Oゼロ）。
 *
 * backend の matchedConditions には性質の異なる2種が混在している:
 * - 等価一致（eventName / payload.<k>）… 一致した「根拠」。一致済みなので
 *   期待値と実値は同一＝2カラムに同じ長い文字列を重複表示せず、1つの値に畳む。
 * - しきい値ゲート（similarity, expectedValue=">=0.6"）… これは一致でなく
 *   「確定の条件式」。根拠テーブルに混ぜず gate として分離し、
 *   「しきい値を満たしたから準・既知に確定（下回れば AI 調査へ）」という
 *   決定論の判断ルールとして見せる。
 *
 * 分類 Rule の語彙（eventName / similarity / payload.*）は決定論で固定
 * （conditionFieldLabel と同じ前提）。similarity 以外に条件式は存在しない。
 */

export type MatchedEvidenceRow = {
  /** 人間語の項目名（例:「受信イベント名」）。 */
  readonly label: string;
  /** 生フィールド名の副表示（訳せた場合のみ）。 */
  readonly raw?: string;
  /** 一致した値（実値）。等価一致では期待値と同一なので1つに畳む。 */
  readonly value: string;
  /**
   * 期待値が実値と異なる場合のみ設定（防御表示）。類似分類では過去事例の
   * eventName が今回と異なり得るため、そのときだけ両方見せる。
   */
  readonly expected?: string;
};

/** 類似度のしきい値ゲート。値は donut（約NN%）と同じ百分率語彙で揃える。 */
export type SimilarityGateView = {
  readonly raw: string;
  /** 実測の類似度（例: "67%"）。 */
  readonly actualLabel: string;
  /** 採用しきい値（例: "60%"）。 */
  readonly thresholdLabel: string;
};

export type ClassificationEvidenceView = {
  readonly rows: MatchedEvidenceRow[];
  readonly similarityGate?: SimilarityGateView;
};

/** 一致条件の値を表示用に整形（文字列はそのまま、非整数は2桁に丸め、それ以外は JSON 表記）。 */
function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && !Number.isInteger(value)) {
    return value.toFixed(2);
  }
  return JSON.stringify(value);
}

const percent = (score: number): string => `${Math.round(score * 100)}%`;

// SimilarPatternRule が出す条件式の形（expectedValue = ">=0.6"）だけを認める。
const GATE_EXPECTED = /^>=\s*(\d+(?:\.\d+)?)$/;

function parseSimilarityGate(
  condition: MatchedConditionView,
): SimilarityGateView | null {
  if (condition.field !== "similarity") return null;
  if (typeof condition.expectedValue !== "string") return null;
  const threshold = GATE_EXPECTED.exec(condition.expectedValue);
  if (!threshold || typeof condition.actualValue !== "number") return null;
  return {
    raw: condition.field,
    actualLabel: percent(condition.actualValue),
    thresholdLabel: percent(Number(threshold[1])),
  };
}

export function classificationEvidence(
  conditions: readonly MatchedConditionView[],
): ClassificationEvidenceView {
  const rows: MatchedEvidenceRow[] = [];
  let similarityGate: SimilarityGateView | undefined;

  for (const condition of conditions) {
    const gate = parseSimilarityGate(condition);
    if (gate) {
      similarityGate = gate;
      continue;
    }
    // 形が想定外の similarity（旧データ等）は捏造せず通常行として出す。
    const field = describeConditionField(condition.field);
    const value = formatValue(condition.actualValue);
    const expected = formatValue(condition.expectedValue);
    rows.push({
      label: field.label,
      ...(field.raw !== undefined ? { raw: field.raw } : {}),
      value,
      ...(expected !== value ? { expected } : {}),
    });
  }

  return { rows, ...(similarityGate ? { similarityGate } : {}) };
}
