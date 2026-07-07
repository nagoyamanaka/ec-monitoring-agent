import { describe, it, expect } from "vitest";
import {
  FORECAST_PENDING_PLAN_SEED,
  withPendingPlanEvidenceUrl,
} from "./ForecastPendingPlanSeed.js";

describe("withPendingPlanEvidenceUrl", () => {
  const url = "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/61";

  it("url を持たない seed plan に deep link を後付けする", () => {
    const [plan] = withPendingPlanEvidenceUrl(FORECAST_PENDING_PLAN_SEED, url);
    expect(plan.url).toBe(url);
    // seed 本体（fixture）は不変
    expect(FORECAST_PENDING_PLAN_SEED[0].url).toBeUndefined();
  });

  it("空文字（未設定）なら url を付けず撮影済み表示を維持する", () => {
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
