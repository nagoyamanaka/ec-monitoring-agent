import type { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import type { InfraEvidence } from "../../domain/InfraEvidence.js";

/**
 * 「収集した証拠」のうち直近コミットを、AI 調査が原因として引用した sha だけに絞る。
 *
 * 背景: InfraEvidence の収集は category 駆動で「直近 N 件のコミット」を無条件に積む
 * （DefaultInfraInvestigationAdapter）。そのため APPLICATION/SECURITY のアラートでは、原因と
 * 無関係なマージコミットや別件 commit まで証拠パネルに並んでしまう。原因でない証拠は出さないと
 * いう方針に合わせ、AI が報告書で実際に引用した証拠 id（impact.citations /
 * escalation.evidenceBundle / remediationReview.citations）と summary に sha が現れるコミットだけ
 * を残す。引用が無ければコミットは出さない（根拠なき列挙を避ける）。
 *
 * 注意: investigationSteps / suggestedActions は決定的に生成した evidenceLinks（全コミット分の
 * href/テキスト）を末尾へ連結しているため引用源には使わない（使うと全件マッチして絞り込みにならない）。
 */
export function restrictEvidenceToCitedCommits(
  evidence: InfraEvidence,
  report: InvestigationReport | null,
): InfraEvidence {
  const commits = evidence.recentCommits;
  if (!commits || commits.length === 0) return evidence;

  const citedText = collectCitedText(report).toLowerCase();
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

/** 報告書から「AI が引用した証拠 id」をまとめた検索用テキストを作る（sha の包含判定に使う）。 */
function collectCitedText(report: InvestigationReport | null): string {
  if (!report) return "";
  const parts: string[] = [report.summary];
  if (report.impact) parts.push(...report.impact.citations);
  if (report.escalation) parts.push(...report.escalation.evidenceBundle);
  if (report.remediationReview) parts.push(...report.remediationReview.citations);
  return parts.join("\n");
}
