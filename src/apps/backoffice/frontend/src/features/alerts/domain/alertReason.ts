import { type AlertView, isAnalyzing } from "./AlertView";
import { eventTitle } from "./eventCatalog";

/**
 * 「何が起きたと推定したか」を分類/調査から導く純関数。
 * - known: 既知パターン名（classification）
 * - ai: AI 調査の推定パターン名（investigationReport.suggestedPatternName）
 * - analyzing: 調査中（まだ推定が無い）
 * 確信度はこの推定対象に対する値であり、行では確信度チップと対で初めて意味を持つ。
 *
 * 昇格（結晶化）で自動生成されたパターン名は `PROMOTED_<EVENTNAME>` /
 * `AUTO_PROMOTED_<EVENTNAME>` の機械 ID（backend crystallizePatternFromAlert）。
 * 生 ID を一覧の主表示に出さないため、crystallized=true ＋ eventCatalog の
 * 人間語タイトルへ写像し、生 ID は rawPatternName（ツールチップ/詳細用）へ降格する。
 * 昇格パターンは eventName 完全一致でのみマッチするので、alert.eventName から
 * タイトルを引ける（パターンの焼き付け元 eventName と常に一致する）。
 */
export type AlertReason =
  | {
      readonly kind: "known";
      readonly patternName: string;
      /** 昇格（結晶化）由来の自動生成パターンか。UI は結晶化アイコンを添える。 */
      readonly crystallized: boolean;
      /** crystallized のときの生パターン ID（例: PROMOTED_EC.DB...）。表示は tooltip/詳細のみ。 */
      readonly rawPatternName?: string;
    }
  | { readonly kind: "ai"; readonly patternName: string }
  | { readonly kind: "analyzing" };

const PROMOTED_PREFIX = /^(AUTO_)?PROMOTED_/;

export function alertReason(alert: AlertView): AlertReason {
  if (isAnalyzing(alert)) return { kind: "analyzing" };
  if (alert.classification.type === "known") {
    const raw = alert.classification.patternName;
    if (PROMOTED_PREFIX.test(raw)) {
      return {
        kind: "known",
        patternName: eventTitle(alert.eventName),
        crystallized: true,
        rawPatternName: raw,
      };
    }
    return { kind: "known", patternName: raw, crystallized: false };
  }
  if (alert.report) {
    // fallback レポートは suggestedPatternName が空＝「AI推定: 」と空文字が並ぶため、
    // 「調査失敗・再調査可」の定型文で状態を明示する（タスク E3）。
    if (alert.report.isFallback) {
      return { kind: "ai", patternName: "調査失敗・再調査可" };
    }
    const patternName = alert.report.suggestedPatternName.trim();
    if (patternName !== "") {
      return { kind: "ai", patternName };
    }
    // 非 fallback でもパターン名が空になる経路がある（切断出力のサルベージ回収で欠落を
    // 空文字に丸める・LLM が空文字を返す）。「AI推定: 」の後ろを空欄で描かず、
    // 実情報である summary で語る。summary まで空なら fallback と同じ定型文（空 UI 禁止）。
    const summary = alert.report.summary.trim();
    return {
      kind: "ai",
      patternName: summary !== "" ? summary : "調査失敗・再調査可",
    };
  }
  return { kind: "analyzing" };
}
