import { describe, expect, it } from "vitest";
import { alertReason } from "./alertReason";
import { makeAlert, makeReport } from "../test-support/alertFixture";

describe("alertReason", () => {
  it("分析中は analyzing", () => {
    expect(
      alertReason(makeAlert({ status: "ANALYZING", report: null })),
    ).toEqual({ kind: "analyzing" });
  });

  it("既知パターンは classification の patternName", () => {
    const reason = alertReason(
      makeAlert({
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-1",
          patternName: "決済APIタイムアウト",
          confidence: 0.9,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "決済APIタイムアウト",
      crystallized: false,
    });
  });

  it("未知（report あり）は report の suggestedPatternName", () => {
    const reason = alertReason(
      makeAlert({ report: makeReport({ suggestedPatternName: "latency-spike" }) }),
    );
    expect(reason).toEqual({ kind: "ai", patternName: "latency-spike" });
  });

  it("昇格パターン（PROMOTED_）は crystallized＋eventCatalog の人間語へ写像し、生IDは rawPatternName へ降格", () => {
    const reason = alertReason(
      makeAlert({
        eventName: "ec.payment.timeout",
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-2",
          patternName: "PROMOTED_EC.PAYMENT.TIMEOUT",
          confidence: 1,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "決済タイムアウト",
      crystallized: true,
      rawPatternName: "PROMOTED_EC.PAYMENT.TIMEOUT",
    });
  });

  it("自動昇格（AUTO_PROMOTED_）も crystallized。カタログ未登録の eventName は生 eventName へフォールバック", () => {
    const reason = alertReason(
      makeAlert({
        eventName: "custom.unknown.event",
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-3",
          patternName: "AUTO_PROMOTED_CUSTOM.UNKNOWN.EVENT",
          confidence: 1,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "custom.unknown.event",
      crystallized: true,
      rawPatternName: "AUTO_PROMOTED_CUSTOM.UNKNOWN.EVENT",
    });
  });
});
