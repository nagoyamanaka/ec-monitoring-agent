import { describe, expect, it } from "vitest";
import { alertConfidence } from "./alertConfidence";
import { makeAlert, makeReport } from "../test-support/alertFixture";

const knownClassification = (confidence: number) =>
  ({
    type: "known" as const,
    patternId: "p-1",
    patternName: "決済APIタイムアウト",
    confidence,
    matchedConditions: [],
  });

describe("alertConfidence", () => {
  it("分析中は none", () => {
    expect(
      alertConfidence(makeAlert({ status: "ANALYZING", report: null })),
    ).toEqual({ kind: "none" });
  });

  it("既知パターンの完全一致（confidence>=1）は exact-match（％を持たない）", () => {
    expect(
      alertConfidence(
        makeAlert({ report: null, classification: knownClassification(1) }),
      ),
    ).toEqual({ kind: "exact-match" });
  });

  it("既知パターンの部分一致は known＋一致度", () => {
    expect(
      alertConfidence(
        makeAlert({ report: null, classification: knownClassification(0.7) }),
      ),
    ).toEqual({ kind: "known", value: 0.7 });
  });

  it("未知（report あり）は ai＋report の confidence", () => {
    expect(
      alertConfidence(makeAlert({ report: makeReport({ confidence: 0.9 }) })),
    ).toEqual({ kind: "ai", value: 0.9 });
  });

  it("未知で report 未着は none", () => {
    expect(
      alertConfidence(
        makeAlert({ classification: { type: "unknown", confidence: null }, report: null }),
      ),
    ).toEqual({ kind: "none" });
  });
});
