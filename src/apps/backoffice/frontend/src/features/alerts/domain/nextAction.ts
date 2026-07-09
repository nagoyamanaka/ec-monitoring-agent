import type { AlertView } from "./AlertView";
import type { InvestigationStepView } from "./InvestigationReportView";

/**
 * 「次に何をすべきか」の供給源。
 * - remediation: 自責ルート（AI 調査）の推奨アクション（コード/IaC 修正の手順・リンク付き）。
 * - escalation: 他責ルートのエスカレーション草案の暫定回避手順（一次対応）。
 * - memory: 既知/類似（AI 調査を起動しない）で、過去/類似事例 or 既知パターンの対応をなぞる。
 */
export type NextActionOrigin = "remediation" | "escalation" | "memory";

/**
 * 表示用の「次のアクション」。remediation は手順リスト（リンクを持つため steps）、
 * escalation/memory は単文（text）＝形が違うので判別可能ユニオンで持つ。
 */
export type NextActionView =
  | {
      readonly origin: "remediation";
      readonly steps: InvestigationStepView[];
      // AI が「コードで直せる」と判定したか＝下の「自動修正」（シナリオ4のドラフトPR起票）への橋。
      readonly remediable: boolean;
    }
  | {
      readonly origin: "escalation" | "memory";
      readonly text: string;
    };

/**
 * アラートの「次のアクション」を1つに決める純関数（表示は NextActionCard）。
 * 予兆の「今打てる先手」と対になる、対応フェーズの行動指示＝「何が起きた → 次にこれをやる →
 * 誰に渡す」の読み順で結論の直後に置く。全ルートで欠かさない（既知でも「で、何をやるか」を出す）。
 *
 * 優先順位（各ルートは排他なので実質は分類）:
 * 1. 他責（report.escalation あり）→ 暫定回避手順（escalation）。
 * 2. 自責（report.suggestedActions あり）→ 推奨アクション手順（remediation）。
 * 3. 既知/類似（AI 調査レポートなし）→ 対応メモ resolvedNote（memory）。
 *    SIMILARITY は一致事例の対応、EXACT_MATCH は既知パターンの suggestedAction。
 */
export function nextAction(alert: AlertView): NextActionView | null {
  const report = alert.report;
  const interim = report?.escalation?.interimWorkaround.trim();
  if (interim) return { origin: "escalation", text: interim };
  if (report && report.suggestedActions.length > 0) {
    return {
      origin: "remediation",
      steps: report.suggestedActions,
      remediable: report.remediable,
    };
  }
  if (alert.classification.type === "known") {
    const note = alert.classification.resolvedNote?.trim();
    if (note) return { origin: "memory", text: note };
  }
  return null;
}
