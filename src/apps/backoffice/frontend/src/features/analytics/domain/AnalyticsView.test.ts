import { describe, expect, it } from "vitest";
import { type AnalyticsDto, toAnalyticsView } from "./AnalyticsView";

const base: AnalyticsDto = {
  totalAlerts: 10,
  knownCount: 6,
  unknownCount: 4,
  withFeedbackCount: 5,
  correctCount: 4,
  incorrectCount: 1,
  accuracy: 0.8,
};

describe("toAnalyticsView", () => {
  it("accuracy を整数％へ・known 比率を算出する", () => {
    const v = toAnalyticsView(base);
    expect(v.accuracyPercent).toBe(80);
    expect(v.knownRatio).toBeCloseTo(0.6);
  });

  it("フィードバック未着（accuracy=null）は percent も null", () => {
    const v = toAnalyticsView({ ...base, accuracy: null });
    expect(v.accuracy).toBeNull();
    expect(v.accuracyPercent).toBeNull();
  });

  it("総数0でも 0除算せず knownRatio=0", () => {
    const v = toAnalyticsView({
      totalAlerts: 0,
      knownCount: 0,
      unknownCount: 0,
      withFeedbackCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: null,
    });
    expect(v.knownRatio).toBe(0);
  });
});
