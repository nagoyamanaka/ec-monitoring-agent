import type { InvestigationReportView } from "./InvestigationReportView";
import type { EvidenceLedgerKey } from "./evidenceLedger";
import { formatElapsed } from "./investigationWorkload";

/**
 * 証拠フローダイアグラム（タスク E8-A）の表示モデル・純関数。
 * 「どのソースから何件の証拠が流入し、AI 調査が1つの結論に収束させたか」を図にするための
 * 導出で、数字は全て backend が記録した実測＝LLM 出力に依存しない
 * （調査収集は InvestigationMetrics・Trivy CVE だけは検知イベント payload の実測件数）。
 * 描けない条件（旧データ・fallback・証拠0件）では null を返し、表示側は G1 の
 * ⏱ テキスト1行へ劣化する（捏造してまで図は出さない）。
 */

export type EvidenceFlowSourceKey = EvidenceLedgerKey;

export type EvidenceFlowSource = {
  readonly key: EvidenceFlowSourceKey;
  readonly label: string;
  readonly icon: string;
  readonly count: number;
  /** コネクタの離散太さ 1..3。連続スケールは fake precision になるため段階のみ。 */
  readonly weight: 1 | 2 | 3;
};

export type EvidenceFlowModel = {
  /** 証拠が実際に取れた流入源のみ（0件のソースは「流入した」と主張しない）。 */
  readonly sources: EvidenceFlowSource[];
  readonly elapsedLabel: string;
  readonly evidenceTotal: number;
  /** 結論ノードに出す確信度（補正後の report.confidence）。 */
  readonly confidence: number;
  /** 図全体の読み上げ用1文（視覚表現の代替テキスト）。 */
  readonly ariaSummary: string;
};

/** アイコン・呼称は EvidencePanel の SOURCE_META / investigationWorkload と統一する。 */
const SOURCE_META: ReadonlyArray<
  [EvidenceFlowSourceKey, { label: string; icon: string }]
> = [
  ["security", { label: "Trivy (CI スキャン)", icon: "🛡" }],
  ["logs", { label: "Cloud Logging", icon: "▤" }],
  ["metrics", { label: "Cloud Monitoring", icon: "📈" }],
  ["terraformChanges", { label: "Terraform", icon: "⬡" }],
  ["commits", { label: "GitHub", icon: "❮❯" }],
  ["similarIncidents", { label: "類似事例DB", icon: "◎" }],
];

function toWeight(count: number): 1 | 2 | 3 {
  if (count >= 6) return 3;
  if (count >= 3) return 2;
  return 1;
}

export function evidenceFlowModel(
  report: InvestigationReportView | null,
  /** Trivy（CI スキャン）の CVE 件数。検知 payload 由来＝確信度を支えた流入源として図に載せる。 */
  securityFindingCount = 0,
): EvidenceFlowModel | null {
  // fallback は結論に収束していない（E3 の証拠リンク温存表示が主役）＝図は出さない。
  if (!report || report.isFallback || !report.metrics) return null;

  const counts = report.metrics.evidenceCounts;
  const countOf = (key: EvidenceFlowSourceKey): number =>
    key === "security" ? securityFindingCount : counts[key];
  const sources: EvidenceFlowSource[] = SOURCE_META.filter(
    ([key]) => countOf(key) > 0,
  ).map(([key, meta]) => ({
    key,
    label: meta.label,
    icon: meta.icon,
    count: countOf(key),
    weight: toWeight(countOf(key)),
  }));
  if (sources.length === 0) return null;

  const evidenceTotal = sources.reduce((sum, s) => sum + s.count, 0);
  const elapsedLabel = formatElapsed(report.metrics.elapsedMs);
  const confidencePercent = Math.round(report.confidence * 100);
  const sourceText = sources.map((s) => `${s.label} ${s.count}件`).join("・");

  return {
    sources,
    elapsedLabel,
    evidenceTotal,
    confidence: report.confidence,
    ariaSummary: `${elapsedLabel}で ${sourceText} の証拠 ${evidenceTotal} 件を収集し、AI 調査が1つの結論に収束（確信度 ${confidencePercent}%）`,
  };
}
