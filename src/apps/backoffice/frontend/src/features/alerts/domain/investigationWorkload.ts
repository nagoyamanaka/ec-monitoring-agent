import type { InvestigationMetricsView } from "./InvestigationReportView";

/**
 * 調査レポート冒頭の「働きの明細」1行サマリ（タスク G1）への写像・純関数。
 * 「92秒で Cloud Logging・GitHub・類似事例DB を横断し、証拠62件を収集して原因を推定」
 * の数字は全て backend が記録した実測（InvestigationMetrics）から導出する。
 * 「人間なら◯分」等の根拠を出せない換算は行わない（正直さの制約）。
 */
export type WorkloadSummary = {
  /** 実測経過時間の表示文字列（例: "92秒" / "1秒未満"）。 */
  readonly elapsedLabel: string;
  /** 実際に証拠が取れた横断ソースの表示名（件数 0 のソースは「横断した」と主張しない）。 */
  readonly sources: string[];
  /** 収集した証拠の合計件数。 */
  readonly evidenceTotal: number;
};

/** 証拠内訳キー → 表示ソース名（EvidencePanel の SOURCE_META と同じ呼称に揃える）。 */
const SOURCE_LABELS: ReadonlyArray<
  [keyof InvestigationMetricsView["evidenceCounts"], string]
> = [
  ["logs", "Cloud Logging"],
  ["metrics", "Cloud Monitoring"],
  ["terraformChanges", "Terraform"],
  ["commits", "GitHub"],
  ["similarIncidents", "類似事例DB"],
];

export function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < 1000) return "1秒未満";
  return `${Math.round(elapsedMs / 1000)}秒`;
}

export function workloadSummary(
  metrics: InvestigationMetricsView | undefined,
): WorkloadSummary | null {
  if (!metrics) return null;
  const counts = metrics.evidenceCounts;
  const sources = SOURCE_LABELS.filter(([key]) => counts[key] > 0).map(
    ([, label]) => label,
  );
  const evidenceTotal = SOURCE_LABELS.reduce(
    (sum, [key]) => sum + counts[key],
    0,
  );
  return {
    elapsedLabel: formatElapsed(metrics.elapsedMs),
    sources,
    evidenceTotal,
  };
}
