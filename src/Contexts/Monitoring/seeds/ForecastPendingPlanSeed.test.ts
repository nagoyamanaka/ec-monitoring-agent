import { describe, it, expect } from "vitest";
import {
  FORECAST_PENDING_PLAN_SEED,
  withPendingPlanEvidenceUrl,
} from "./ForecastPendingPlanSeed.js";

describe("FORECAST_PENDING_PLAN_SEED", () => {
  it("flagship plan-1 は実在リソース（バックボーン VM）の machine_type 縮小", () => {
    const [plan] = FORECAST_PENDING_PLAN_SEED;
    expect(plan.resourceChanges[0].address).toBe(
      "module.gce_backbone.google_compute_instance.backbone",
    );
    expect(plan.resourceChanges[0].attributeDeltas[0]).toEqual({
      key: "machine_type",
      before: "e2-standard-2",
      after: "e2-small",
    });
    // seed 本体は url を持たない（env 経由で後付け）
    expect(plan.url).toBeUndefined();
  });
});

describe("withPendingPlanEvidenceUrl", () => {
  const url = "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/83";

  it("url を持たない seed plan に deep link を後付けする（seed 本体は不変）", () => {
    const [plan] = withPendingPlanEvidenceUrl(FORECAST_PENDING_PLAN_SEED, url);
    expect(plan.url).toBe(url);
    expect(FORECAST_PENDING_PLAN_SEED[0].url).toBeUndefined();
  });

  it("空文字なら url を付けない（非リンク表示に戻す）", () => {
    const [plan] = withPendingPlanEvidenceUrl(FORECAST_PENDING_PLAN_SEED, "");
    expect(plan.url).toBeUndefined();
  });

  it("既に url を持つ plan は上書きしない", () => {
    const existing = "https://example.com/pr/1";
    const [plan] = withPendingPlanEvidenceUrl(
      [{ ...FORECAST_PENDING_PLAN_SEED[0], url: existing }],
      url,
    );
    expect(plan.url).toBe(existing);
  });
});
