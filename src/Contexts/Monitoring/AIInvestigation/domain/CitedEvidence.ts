/**
 * 「AI が報告書で実際に引用した証拠 id」の判定を単一ソース化する。
 *
 * 引用源は summary / impact.citations / escalation.evidenceBundle /
 * remediationReview.citations に限定する（investigationSteps / suggestedActions は
 * 決定的生成の evidenceLinks 全件を末尾連結しているため、引用源に使うと全件マッチして
 * 絞り込みにならない）。証拠パネルの直近コミット絞り（CitedCommitFilter）と
 * 調査ステップ末尾のコミットリンク絞り（InvestigationReportMapper）が同じ判定を共有し、
 * 「ステップには10コミット・証拠は0件」のような両者の食い違いを防ぐ。
 */

/** InvestigationReport（ドメイン）と検証済みLLM出力の両方が構造的に満たす引用源の形。 */
export type CitedEvidenceSource = {
  readonly summary: string;
  readonly impact?: { readonly citations: readonly string[] };
  readonly escalation?: { readonly evidenceBundle: readonly string[] };
  readonly remediationReview?: { readonly citations: readonly string[] };
};

/** 引用源をまとめた検索用テキストを作る（sha の包含判定に使う）。 */
export function collectCitedEvidenceText(source: CitedEvidenceSource | null): string {
  if (!source) return "";
  const parts: string[] = [source.summary];
  if (source.impact) parts.push(...source.impact.citations);
  if (source.escalation) parts.push(...source.escalation.evidenceBundle);
  if (source.remediationReview) parts.push(...source.remediationReview.citations);
  return parts.join("\n");
}
