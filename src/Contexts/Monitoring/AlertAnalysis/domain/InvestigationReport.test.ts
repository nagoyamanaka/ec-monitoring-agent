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
