import type { AlertCategory } from "./AlertView";
import type { InvestigationMetricsView } from "./InvestigationReportView";

/**
 * 証拠台帳（EvidenceCountsGrid・タスク C-3）に載せるセル集合の導出・純関数。
 *
 * backend の DefaultInfraInvestigationAdapter は category オーナーシップで証拠源を
 * 出し分ける（メトリクス=INFRASTRUCTURE/CAPACITY・Terraform=INFRASTRUCTURE・
 * コミット=SECURITY/APPLICATION）。調べていない証拠源まで台帳に 0 で並べると
 * 「調査済み・該当証拠なし」の但し書きが嘘になるため、調査対象の証拠源だけに絞る。
 * これで台帳の 0 は常に「探した結果ゼロ」を意味する。
 *
 * security（Trivy CVE）は調査収集でなく検知イベント payload 由来＝件数がある時だけ載せる。
 * 防御: backend とルールがずれても実測 >0 の証拠源は必ず載せる（不一致で証拠を隠さない）。
 */
export type EvidenceLedgerKey =
  | keyof InvestigationMetricsView["evidenceCounts"]
  | "security";

/** セクション表示順（security 先頭）と揃えた台帳の正順。 */
const LEDGER_ORDER: ReadonlyArray<EvidenceLedgerKey> = [
  "security",
  "logs",
  "metrics",
  "terraformChanges",
  "commits",
  "similarIncidents",
];

export function evidenceLedgerKeys(
  category: AlertCategory,
  counts: InvestigationMetricsView["evidenceCounts"],
  securityFindingCount: number,
): EvidenceLedgerKey[] {
  // ログと類似事例DB は全 category で調査する。
  const investigated = new Set<EvidenceLedgerKey>(["logs", "similarIncidents"]);
  if (category === "INFRASTRUCTURE" || category === "CAPACITY") {
    investigated.add("metrics");
  }
  if (category === "INFRASTRUCTURE") {
    investigated.add("terraformChanges");
  }
  if (category === "SECURITY" || category === "APPLICATION") {
    investigated.add("commits");
  }
  for (const key of Object.keys(counts) as (keyof typeof counts)[]) {
    if (counts[key] > 0) investigated.add(key);
  }
  if (securityFindingCount > 0) investigated.add("security");
  return LEDGER_ORDER.filter((key) => investigated.has(key));
}
