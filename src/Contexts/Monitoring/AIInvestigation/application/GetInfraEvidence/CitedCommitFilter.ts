import type { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import type { InfraEvidence } from "../../domain/InfraEvidence.js";
import { collectCitedEvidenceText } from "../../domain/CitedEvidence.js";

/**
 * 「収集した証拠」のうち直近コミットを、AI 調査が原因として引用した sha だけに絞る。
 *
 * 背景: InfraEvidence の収集は category 駆動で「直近 N 件のコミット」を無条件に積む
 * （DefaultInfraInvestigationAdapter）。そのため APPLICATION/SECURITY のアラートでは、原因と
 * 無関係なマージコミットや別件 commit まで証拠パネルに並んでしまう。原因でない証拠は出さないと
 * いう方針に合わせ、AI が報告書で実際に引用した証拠 id と summary に sha が現れるコミットだけ
 * を残す。引用が無ければコミットは出さない（根拠なき列挙を避ける）。
 * 引用判定は CitedEvidence（domain）を単一ソースとし、調査ステップ側の evidenceLinks 絞り
 * （InvestigationReportMapper）と同じ基準を共有する。
 */
export function restrictEvidenceToCitedCommits(
  evidence: InfraEvidence,
  report: InvestigationReport | null,
): InfraEvidence {
  const commits = evidence.recentCommits;
  if (!commits || commits.length === 0) return evidence;

  const citedText = collectCitedEvidenceText(report).toLowerCase();
  const cited = citedText
    ? commits.filter((c) => citedText.includes(c.sha.toLowerCase()))
    : [];

  if (cited.length === commits.length) return evidence;
  if (cited.length === 0) {
    const { recentCommits: _dropped, ...withoutCommits } = evidence;
    return withoutCommits;
  }
  return { ...evidence, recentCommits: cited };
}
