import { describe, it, expect } from "vitest";
import type { InvestigationReportPrimitives } from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import {
  toInvestigationReportView,
  isReviewed,
} from "./InvestigationReportView";

function makePrimitives(
  overrides: Partial<InvestigationReportPrimitives> = {},
): InvestigationReportPrimitives {
  return {
    summary: "サマリ",
    confidence: 0.9,
    severity: "CRITICAL",
    investigationSteps: [],
    suggestedActions: [],
    suggestedPatternName: "p",
    reviewStatus: "PENDING_REVIEW",
    investigatedAt: "2026-06-21T00:00:00.000Z",
    isFallback: false,
    ...overrides,
  };
}

describe("toInvestigationReportView", () => {
  it("素の文字列ステップは { text } へ正規化される（後方互換）", () => {
    const view = toInvestigationReportView(
      makePrimitives({ investigationSteps: ["ログ確認", "メトリクス相関"] }),
    );

    expect(view.investigationSteps).toEqual([
      { text: "ログ確認" },
      { text: "メトリクス相関" },
    ]);
  });

  it("構造化ステップ（href/kind）はそのまま保持される", () => {
    const view = toInvestigationReportView(
      makePrimitives({
        investigationSteps: [
          { text: "ログを見る", href: "https://logs.example/q", kind: "log" },
        ],
        suggestedActions: [
          { text: "PR を確認", href: "https://github.com/x/y/pull/1", kind: "code" },
        ],
      }),
    );

    expect(view.investigationSteps[0]).toEqual({
      text: "ログを見る",
      href: "https://logs.example/q",
      kind: "log",
    });
    expect(view.suggestedActions[0].href).toBe("https://github.com/x/y/pull/1");
  });

  it("文字列と構造化の混在も両方正規化される", () => {
    const view = toInvestigationReportView(
      makePrimitives({
        suggestedActions: ["手動再処理", { text: "PR", href: "https://h" }],
      }),
    );

    expect(view.suggestedActions).toEqual([
      { text: "手動再処理" },
      { text: "PR", href: "https://h", kind: undefined },
    ]);
  });

  it("remediable 未指定は false 扱い", () => {
    const view = toInvestigationReportView(makePrimitives());
    expect(view.remediable).toBe(false);
  });
});

describe("isReviewed", () => {
  it("PENDING_REVIEW は未レビュー", () => {
    expect(isReviewed("PENDING_REVIEW")).toBe(false);
  });
  it("APPROVED / REJECTED はレビュー済み", () => {
    expect(isReviewed("APPROVED")).toBe(true);
    expect(isReviewed("REJECTED")).toBe(true);
  });
});
