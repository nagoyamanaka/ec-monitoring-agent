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

import type { InfraEvidence } from "./InfraEvidence.js";

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

/**
 * 相関（relatedAlerts）の citation が指せる「収集済み証拠 id」の語彙（小文字化済み）。
 *
 * 相関の判別軸は「共有証拠の有無」（タスク J1）＝関連の citation はこの語彙のいずれかに
 * 解決しなければ破棄される。語彙は捏造相関への歯として効く強い証拠に限定する:
 * - commit sha / terraform リソースアドレス・由来 sha / メトリクス名（Cloud Monitoring）
 * - appLogs は含めない（安定 id が無く、resource 名は「同時期にログが存在する」程度の
 *   弱い歯＝捏造を通す）。similarIncidents も含めない（自分の類似事例を写すだけで解決して
 *   しまい、「infraEvidence ゼロの他責障害では指せる共有証拠が無い」という構造の歯が抜ける）。
 * 因果の向きの妥当性は決定論では判定しない（correlation_verifier＝タスク J2 の領分）。
 */
export function collectCitableEvidenceIds(evidence: InfraEvidence | undefined): string[] {
  if (!evidence) return [];
  const ids: string[] = [];
  for (const commit of evidence.recentCommits ?? []) ids.push(commit.sha);
  const diff = evidence.terraformDiff;
  if (diff) {
    ids.push(...diff.resourceChanges.map((c) => c.address), ...diff.changedResources);
    if (diff.commitSha) ids.push(diff.commitSha);
  }
  for (const metric of evidence.metrics ?? []) {
    ids.push(metric.metricType, metric.displayName);
  }
  return [...new Set(ids.map((id) => id.toLowerCase()).filter((id) => id.trim() !== ""))];
}
