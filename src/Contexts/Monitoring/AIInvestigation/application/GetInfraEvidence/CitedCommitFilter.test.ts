import { describe, it, expect } from "vitest";
import { restrictEvidenceToCitedCommits } from "./CitedCommitFilter.js";
import { InfraEvidence } from "../../domain/InfraEvidence.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";

const commit = (sha: string, message: string) => ({
  sha,
  message,
  author: "dev",
  committedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const makeEvidence = (): InfraEvidence => ({
  appLogs: [],
  recentCommits: [
    commit("e12b655", "perf(orders): float 演算を回避"),
    commit("740498f", "Merge pull request #6"),
    commit("cbb0f6b", "Merge pull request #5"),
  ],
  collectedAt: new Date("2026-01-01T00:02:00.000Z"),
});

const reportWith = (params: {
  summary?: string;
  impactCitations?: string[];
  evidenceBundle?: string[];
  reviewCitations?: string[];
}): InvestigationReport =>
  new InvestigationReport({
    summary: params.summary ?? "要約",
    confidence: 0.8,
    severity: AlertSeverity.warning(),
    investigationSteps: [],
    suggestedActions: [],
    suggestedPatternName: "P",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date(),
    isFallback: false,
    ...(params.impactCitations
      ? {
          impact: {
            fault: "own" as const,
            scope: "s",
            scale: "sc",
            affectedSubjects: [],
            citations: params.impactCitations,
          },
        }
      : {}),
    ...(params.evidenceBundle
      ? {
          escalation: {
            team: "t",
            owner: "o",
            contact: "c",
            reason: "r",
            interimWorkaround: "w",
            severityRationale: "sr",
            evidenceBundle: params.evidenceBundle,
          },
        }
      : {}),
    ...(params.reviewCitations
      ? {
          remediationReview: {
            verdict: "pass" as const,
            concerns: [],
            pullRequestUrl: "https://example.com/pr/1",
            citations: params.reviewCitations,
          },
        }
      : {}),
  });

describe("restrictEvidenceToCitedCommits", () => {
  it("impact.citations が引用した sha のコミットだけ残す", () => {
    const result = restrictEvidenceToCitedCommits(
      makeEvidence(),
      reportWith({ impactCitations: ["commit e12b655 が原因"] }),
    );
    expect(result.recentCommits?.map((c) => c.sha)).toEqual(["e12b655"]);
  });

  it("summary 本文に現れる sha でも残す（散文での言及を拾う）", () => {
    const result = restrictEvidenceToCitedCommits(
      makeEvidence(),
      reportWith({ summary: "直近の e12b655 による退行" }),
    );
    expect(result.recentCommits?.map((c) => c.sha)).toEqual(["e12b655"]);
  });

  it("escalation.evidenceBundle / remediationReview.citations の引用も拾う", () => {
    const result = restrictEvidenceToCitedCommits(makeEvidence(), {
      ...reportWith({
        evidenceBundle: ["740498f"],
        reviewCitations: ["cbb0f6b の diff"],
      }),
    } as InvestigationReport);
    expect(result.recentCommits?.map((c) => c.sha).sort()).toEqual([
      "740498f",
      "cbb0f6b",
    ]);
  });

  it("どの引用にも現れないコミットは全て落とし、recentCommits を外す", () => {
    const result = restrictEvidenceToCitedCommits(
      makeEvidence(),
      reportWith({ impactCitations: ["terraform module.db"] }),
    );
    expect(result.recentCommits).toBeUndefined();
  });

  it("報告書が無ければコミットは出さない（原因を裏付けられない）", () => {
    const result = restrictEvidenceToCitedCommits(makeEvidence(), null);
    expect(result.recentCommits).toBeUndefined();
  });

  it("コミット以外の証拠（ログ・collectedAt）は変更しない", () => {
    const evidence = {
      ...makeEvidence(),
      appLogs: [
        {
          timestamp: new Date("2026-01-01T00:01:00.000Z"),
          severity: "ERROR" as const,
          message: "boom",
          resource: "svc",
        },
      ],
    };
    const result = restrictEvidenceToCitedCommits(
      evidence,
      reportWith({ impactCitations: ["nope"] }),
    );
    expect(result.appLogs).toHaveLength(1);
    expect(result.collectedAt).toEqual(evidence.collectedAt);
  });

  it("recentCommits が無い証拠はそのまま返す", () => {
    const evidence: InfraEvidence = {
      appLogs: [],
      collectedAt: new Date(),
    };
    expect(restrictEvidenceToCitedCommits(evidence, null)).toBe(evidence);
  });
});
