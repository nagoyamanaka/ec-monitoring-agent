import { describe, expect, it } from "vitest";
import { alertConfidence } from "./alertConfidence";
import { makeAlert, makeReport } from "../test-support/alertFixture";
import type { ClassificationSource } from "./AlertView";

const knownClassification = (
  source: ClassificationSource,
  confidence: number,
) =>
  ({
    type: "known" as const,
    source,
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

  it("EXACT_MATCH 由来は exact-match（％を持たない・confidence 値に依存しない）", () => {
    expect(
      alertConfidence(
        makeAlert({
          report: null,
          classification: knownClassification("EXACT_MATCH", 1),
        }),
      ),
    ).toEqual({ kind: "exact-match" });
  });

  it("SIMILARITY 由来（類似一致）は known＋一致度", () => {
    expect(
      alertConfidence(
        makeAlert({
          report: null,
          classification: knownClassification("SIMILARITY", 0.7),
        }),
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
