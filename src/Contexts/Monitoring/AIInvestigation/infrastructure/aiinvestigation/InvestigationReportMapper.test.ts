import { describe, it, expect } from "vitest";
import { toInvestigationReport, buildFallbackReport } from "./InvestigationReportMapper.js";
import { LLMInvestigationOutput } from "./LLMOutputParser.js";
import { AlertSeverities } from "../../../AlertAnalysis/domain/AlertSeverity.js";
import { ReviewStatuses } from "../../../AlertAnalysis/domain/ReviewStatus.js";

function output(overrides: Partial<LLMInvestigationOutput> = {}): LLMInvestigationOutput {
  return {
    summary: "DB接続枯渇",
    confidence: 0.87,
    severity: "CRITICAL",
    investigationSteps: ["ログ確認"],
    suggestedActions: ["プール拡張"],
    suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
    ...overrides,
  };
}

describe("InvestigationReportMapper", () => {
  describe("toInvestigationReport", () => {
    it("有効な出力をInvestigationReportへマッピングする", () => {
      const report = toInvestigationReport(output());
      expect(report.summary).toBe("DB接続枯渇");
      expect(report.severity.value).toBe(AlertSeverities.CRITICAL);
      expect(report.confidence).toBe(0.87);
      expect(report.isFallback).toBe(false);
      expect(report.reviewStatus.value).toBe(ReviewStatuses.PENDING_REVIEW);
    });

    it("confidenceを[0,1]にクランプする", () => {
      expect(toInvestigationReport(output({ confidence: 1.5 })).confidence).toBe(1);
      expect(toInvestigationReport(output({ confidence: -0.3 })).confidence).toBe(0);
    });

    it("severityの大文字小文字を吸収する", () => {
      expect(toInvestigationReport(output({ severity: "info" })).severity.value).toBe(AlertSeverities.INFO);
    });

    it("未知のseverityはWARNINGに丸める", () => {
      expect(toInvestigationReport(output({ severity: "FATAL" })).severity.value).toBe(AlertSeverities.WARNING);
    });
  });

  describe("buildFallbackReport", () => {
    it("isFallback=true・confidence=0・WARNINGのレポートを返す", () => {
      const report = buildFallbackReport();
      expect(report.isFallback).toBe(true);
      expect(report.confidence).toBe(0);
      expect(report.severity.value).toBe(AlertSeverities.WARNING);
      expect(report.reviewStatus.value).toBe(ReviewStatuses.PENDING_REVIEW);
      expect(report.suggestedActions.length).toBeGreaterThan(0);
    });
  });
});
