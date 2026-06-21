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
          patternId: "p-1",
          patternName: "決済APIタイムアウト",
          confidence: 0.9,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({ kind: "known", patternName: "決済APIタイムアウト" });
  });

  it("未知（report あり）は report の suggestedPatternName", () => {
    const reason = alertReason(
      makeAlert({ report: makeReport({ suggestedPatternName: "latency-spike" }) }),
    );
    expect(reason).toEqual({ kind: "ai", patternName: "latency-spike" });
  });
});
