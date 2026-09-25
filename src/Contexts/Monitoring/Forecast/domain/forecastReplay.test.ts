import { describe, it, expect } from "vitest";
import { ForecastIssued } from "./ForecastLedger.js";
import { compareReplayWithLedger } from "./forecastReplay.js";
import { RiskForecast, RiskItem } from "./RiskForecast.js";

const risk = (subject: string, level: RiskItem["level"]): RiskItem => ({
  window: "土",
  subject,
  level,
  confidence: 0.5,
  citations: ["x"],
  reasoning: "r",
});

const replayed = (risks: RiskItem[]): RiskForecast => ({
  forecastId: "replay",
  generatedAt: new Date("2026-09-26T00:00:00.000Z"),
  horizon: "今週末",
  risks,
  isFallback: false,
});

const row = (
  briefingId: string,
  forecasterVersion: string,
  subjectKey: string,
  level: ForecastIssued["level"],
): ForecastIssued => ({
  eventType: "issued",
  forecastId: `${briefingId}-${subjectKey}`,
  briefingId,
  protocolVersion: "p",
  forecasterVersion,
  subjectKey,
  class: "change_risk",
  level,
  issuedAt: new Date("2026-09-25T00:00:00.000Z"),
  windowLengthHours: 72,
  windowEndsAt: new Date("2026-09-28T00:00:00.000Z"),
  windowPolicyVersion: "w",
  evidenceSnapshotId: "snap",
  signalFingerprint: "fp",
  assignment: "normal",
  assignmentProb: 1,
});

describe("compareReplayWithLedger", () => {
  it("同じ版の記録と subject ごとの level が一致すれば true（順序は問わない）", () => {
    const result = compareReplayWithLedger(
      replayed([risk("a", "HIGH"), risk("b", "LOW")]),
      [row("b1", "v1", "b", "LOW"), row("b1", "v1", "a", "HIGH")],
      "v1",
    );
    expect(result.sameVersionLevelsMatch).toBe(true);
    expect(result.replayed).toEqual(["a=HIGH", "b=LOW"]);
  });

  it("level が1件でも違えば false", () => {
    const result = compareReplayWithLedger(
      replayed([risk("a", "MEDIUM")]),
      [row("b1", "v1", "a", "HIGH")],
      "v1",
    );
    expect(result.sameVersionLevelsMatch).toBe(false);
  });

  it("別の版の記録は比較に使わず、同じ版が無ければ null", () => {
    const result = compareReplayWithLedger(
      replayed([risk("a", "HIGH")]),
      [row("b1", "v0", "a", "LOW")],
      "v1",
    );
    expect(result.sameVersionLevelsMatch).toBeNull();
    expect(result.recorded).toEqual([{ briefingId: "b1", forecasterVersion: "v0", levels: ["a=LOW"] }]);
  });
});
