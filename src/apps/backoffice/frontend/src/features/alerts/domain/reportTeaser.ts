import type { InvestigationReportView } from "./InvestigationReportView";

/**
 * ドロワー末尾 CTA 用の「詳細ページ限定コンテンツ」ティザー（タスク D5）。
 * summary と障害規模(impact.scale)はドロワー本文（summary 射影・タスク37）が既に出しているため
 * 数えず、full 射影で初めて見えるものだけをインベントリ化する＝「詳細ページに行くと何が
 * 読めるか」をクリック前に伝え、テキストリンクの空手形をなくす。
 */
export type ReportTeaser = {
  /** クリックの誘い文句＝推奨アクション先頭1件の本文（無ければ null でチップのみ）。 */
  readonly headline: string | null;
  /** 詳細ページ限定コンテンツの見出しチップ（存在するものだけ・報告書の掲載順）。 */
  readonly chips: readonly string[];
};

export function reportTeaser(
  report: InvestigationReportView | null | undefined,
): ReportTeaser | null {
  if (!report) return null;

  const chips: string[] = [];
  if (report.investigationSteps.length > 0) {
    chips.push(`調査ステップ ${report.investigationSteps.length}`);
  }
  if (report.suggestedActions.length > 0) {
    chips.push(`推奨アクション ${report.suggestedActions.length}`);
  }
  if (report.remediable) chips.push("コードで修正可能");
  if (report.impact) chips.push("影響評価");
  if (report.escalation) chips.push("エスカレーション草案");
  if (report.remediationReview) chips.push("修正PRレビュー");

  // 詳細ページ限定コンテンツが何も無い（summary だけの薄いレポート）なら
  // ティザーは成立しない＝呼び出し側は素のリンクにフォールバックする。
  if (chips.length === 0) return null;

  return {
    headline: report.suggestedActions[0]?.text ?? null,
    chips,
  };
}
