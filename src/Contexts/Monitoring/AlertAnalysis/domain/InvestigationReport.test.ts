import { describe, it, expect } from "vitest";
import { InvestigationReport } from "./InvestigationReport.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { ReviewStatus } from "./ReviewStatus.js";

const baseParams = {
  summary: "決済タイムアウトが発生しました",
  confidence: 0.9,
  severity: AlertSeverity.critical(),
  investigationSteps: ["ログを確認", "タイムアウト値を確認"],
  suggestedActions: ["タイムアウト値を延長してください"],
  suggestedPatternName: "PAYMENT_TIMEOUT",
  reviewStatus: ReviewStatus.pendingReview(),
  investigatedAt: new Date("2026-01-01T00:01:00Z"),
  isFallback: false,
};

describe("InvestigationReport toPrimitives / fromPrimitives", () => {
  it("ラウンドトリップで同じ値が復元される", () => {
    const original = new InvestigationReport(baseParams);
    const restored = InvestigationReport.fromPrimitives(
      original.toPrimitives(),
    );

    expect(restored.summary).toBe(original.summary);
    expect(restored.confidence).toBe(original.confidence);
    expect(restored.severity.isCritical()).toBe(true);
    expect(restored.investigationSteps).toEqual(original.investigationSteps);
    expect(restored.suggestedActions).toEqual(original.suggestedActions);
    expect(restored.suggestedPatternName).toBe(original.suggestedPatternName);
    expect(restored.reviewStatus.isPendingReview()).toBe(true);
    expect(restored.investigatedAt.toISOString()).toBe(
      original.investigatedAt.toISOString(),
    );
    expect(restored.isFallback).toBe(original.isFallback);
  });

  it("toPrimitivesでseverityとreviewStatusがstring値になる", () => {
    const primitives = new InvestigationReport(baseParams).toPrimitives();

    expect(primitives.severity).toBe("CRITICAL");
    expect(primitives.reviewStatus).toBe("PENDING_REVIEW");
    expect(typeof primitives.investigatedAt).toBe("string");
  });

  it("fromPrimitivesでseverityとreviewStatusが値オブジェクトになる", () => {
    const restored = InvestigationReport.fromPrimitives(
      new InvestigationReport(baseParams).toPrimitives(),
    );

    expect(restored.severity).toBeInstanceOf(AlertSeverity);
    expect(restored.reviewStatus).toBeInstanceOf(ReviewStatus);
  });

  it("impact は既定で undefined・指定時はラウンドトリップで復元される", () => {
    expect(new InvestigationReport(baseParams).impact).toBeUndefined();

    const impact = {
      fault: "own" as const,
      scope: "決済機能の一部ユーザ",
      scale: "5分間で約120件",
      affectedSubjects: ["payment"],
      citations: ["commit:abc1234"],
    };
    const restored = InvestigationReport.fromPrimitives(
      new InvestigationReport({ ...baseParams, impact }).toPrimitives(),
    );
    expect(restored.impact).toEqual(impact);
  });

  it("impact 無しの旧 Primitives も読める（後方互換）", () => {
    const legacy = new InvestigationReport(baseParams).toPrimitives();
    expect("impact" in legacy).toBe(false);
    expect(InvestigationReport.fromPrimitives(legacy).impact).toBeUndefined();
  });

  it("escalation は既定で undefined・指定時はラウンドトリップで復元される", () => {
    expect(new InvestigationReport(baseParams).escalation).toBeUndefined();

    const escalation = {
      team: "external-vendor-liaison",
      owner: "外部ベンダー窓口",
      contact: "#vendor-liaison",
      reason: "外部決済API起因で自社変更が無い",
      interimWorkaround: "決済リトライ間隔を延長",
      severityRationale: "決済3%失敗・P1",
      evidenceBundle: ["log:abc"],
    };
    const restored = InvestigationReport.fromPrimitives(
      new InvestigationReport({ ...baseParams, escalation }).toPrimitives(),
    );
    expect(restored.escalation).toEqual(escalation);
  });

  it("escalation 無しの旧 Primitives も読める（後方互換）", () => {
    const legacy = new InvestigationReport(baseParams).toPrimitives();
    expect("escalation" in legacy).toBe(false);
    expect(InvestigationReport.fromPrimitives(legacy).escalation).toBeUndefined();
  });

  it("relatedAlerts は既定で空配列・指定時はラウンドトリップで復元される", () => {
    expect(new InvestigationReport(baseParams).relatedAlerts).toEqual([]);

    const related = [
      { alertId: "a2", relation: "downstream", rationale: "波及した" },
    ];
    const restored = InvestigationReport.fromPrimitives(
      new InvestigationReport({
        ...baseParams,
        relatedAlerts: related,
      }).toPrimitives(),
    );
    expect(restored.relatedAlerts).toEqual(related);
  });
});

describe("InvestigationReport.withReviewStatus()", () => {
  it("新しいInvestigationReportを返し、reviewStatusが更新される", () => {
    const original = new InvestigationReport(baseParams);
    const updated = original.withReviewStatus(ReviewStatus.approved());

    expect(updated.reviewStatus.isApproved()).toBe(true);
    expect(updated.summary).toBe(original.summary);
  });

  it("元のInvestigationReportは変更されない(副作用がないことを確認)", () => {
    const original = new InvestigationReport(baseParams);
    original.withReviewStatus(ReviewStatus.approved());

    expect(original.reviewStatus.isPendingReview()).toBe(true);
  });
});
