import {
  type AlertView,
  type ClassificationSource,
  isAnalyzing,
} from "./AlertView";
import { eventTitle } from "./eventCatalog";
import { patternCause } from "./patternLabel";

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
      /** どの分類ルールが当てたか。完全一致は原因を確定調（原因:）、類似は候補調（原因候補:）で出す。 */
      readonly source: ClassificationSource;
      /** 昇格（結晶化）由来の自動生成パターンか。UI は結晶化アイコンを添える。 */
      readonly crystallized: boolean;
      /** crystallized のときの生パターン ID（例: PROMOTED_EC.DB...）。表示は tooltip/詳細のみ。 */
      readonly rawPatternName?: string;
      /**
       * 何が原因だったか（G4b・あれば③行はパターン名でなくこちらを出す）。
       * seed 既知＝要約辞書／結晶化＝承認時の AI 調査 summary（wire patternDescription）。
       */
      readonly cause?: string;
    }
  | { readonly kind: "ai"; readonly patternName: string }
  | { readonly kind: "analyzing" };

const PROMOTED_PREFIX = /^(AUTO_)?PROMOTED_/;

export function alertReason(alert: AlertView): AlertReason {
  if (isAnalyzing(alert)) return { kind: "analyzing" };
  if (alert.classification.type === "known") {
    const raw = alert.classification.patternName;
    const cause = patternCause(raw, alert.classification.patternDescription);
    if (PROMOTED_PREFIX.test(raw)) {
      return {
        kind: "known",
        patternName: eventTitle(alert.eventName),
        source: alert.classification.source,
        crystallized: true,
        rawPatternName: raw,
        ...(cause !== undefined ? { cause } : {}),
      };
    }
    return {
      kind: "known",
      patternName: raw,
      source: alert.classification.source,
      crystallized: false,
      ...(cause !== undefined ? { cause } : {}),
    };
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
