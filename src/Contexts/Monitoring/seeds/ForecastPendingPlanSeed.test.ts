import { describe, it, expect } from "vitest";
import {
  FORECAST_FLAGSHIP_PLAN_ADDRESS,
  FORECAST_PENDING_PLAN_SEED,
  FORECAST_VALKEY_PLAN_ADDRESS,
  withPendingPlanEvidenceUrls,
} from "./ForecastPendingPlanSeed.js";

describe("FORECAST_PENDING_PLAN_SEED", () => {
  it("flagship plan-1 は実在リソース（バックボーン VM）の machine_type 縮小", () => {
    const [plan] = FORECAST_PENDING_PLAN_SEED;
    expect(plan.resourceChanges[0].address).toBe(FORECAST_FLAGSHIP_PLAN_ADDRESS);
    expect(plan.resourceChanges[0].attributeDeltas[0]).toEqual({
      key: "machine_type",
      before: "e2-standard-2",
      after: "e2-small",
    });
    // seed 本体は url を持たない（env 経由で後付け）
    expect(plan.url).toBeUndefined();
  });

  it("plan-2 は Valkey メモリ縮小の合成 plan（実 PR 非対応・valkey/cache トークンを含む）", () => {
    const plan = FORECAST_PENDING_PLAN_SEED[1];
    expect(plan.resourceChanges[0].address).toContain("valkey");
    expect(plan.resourceChanges[0].address).toContain("cache");
    expect(plan.resourceChanges[0].address).not.toBe(FORECAST_FLAGSHIP_PLAN_ADDRESS);
    expect(plan.url).toBeUndefined();
  });
});

describe("withPendingPlanEvidenceUrls", () => {
  const flagshipUrl = "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/83";
  const valkeyUrl = "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/90";

  it("address ごとに別々の実 PR を後付けする（flagship / Valkey・seed 本体は不変）", () => {
    const [flagship, valkey] = withPendingPlanEvidenceUrls(FORECAST_PENDING_PLAN_SEED, {
      [FORECAST_FLAGSHIP_PLAN_ADDRESS]: flagshipUrl,
      [FORECAST_VALKEY_PLAN_ADDRESS]: valkeyUrl,
    });
    expect(flagship.url).toBe(flagshipUrl);
    expect(valkey.url).toBe(valkeyUrl);
    // seed 本体は不変
    expect(FORECAST_PENDING_PLAN_SEED[0].url).toBeUndefined();
    expect(FORECAST_PENDING_PLAN_SEED[1].url).toBeUndefined();
  });

  it("対応表に無い／空文字の address には url を付けない（非リンク表示のまま）", () => {
    const [flagship, valkey] = withPendingPlanEvidenceUrls(FORECAST_PENDING_PLAN_SEED, {
      [FORECAST_FLAGSHIP_PLAN_ADDRESS]: flagshipUrl,
      [FORECAST_VALKEY_PLAN_ADDRESS]: "", // 未起票＝空
    });
    expect(flagship.url).toBe(flagshipUrl);
    expect(valkey.url).toBeUndefined(); // Valkey は空文字なので非リンク
  });

  it("既に url を持つ plan は上書きしない", () => {
    const existing = "https://example.com/pr/1";
    const [plan] = withPendingPlanEvidenceUrls(
      [{ ...FORECAST_PENDING_PLAN_SEED[0], url: existing }],
      { [FORECAST_FLAGSHIP_PLAN_ADDRESS]: flagshipUrl },
    );
    expect(plan.url).toBe(existing);
  });
});
