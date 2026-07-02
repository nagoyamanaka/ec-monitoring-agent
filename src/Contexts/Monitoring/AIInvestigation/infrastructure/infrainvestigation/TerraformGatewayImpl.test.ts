import { describe, expect, it } from "vitest";
import { TerraformGatewayImpl } from "./TerraformGatewayImpl.js";
import { InMemoryAppliedInfraChangeStore } from "./InMemoryAppliedInfraChangeStore.js";
import { AppliedInfraChange } from "./AppliedInfraChangeStore.js";
import { InMemoryPendingInfraPlanStore } from "./InMemoryPendingInfraPlanStore.js";

const change = (
  appliedAt: Date,
  overrides: Partial<AppliedInfraChange> = {},
): AppliedInfraChange => ({
  appliedAt,
  summary: "test",
  resourceChanges: [
    {
      address: "google_sql_database_instance.main",
      action: "update",
      attributeDeltas: [{ key: "max_connections", before: "100", after: "20" }],
    },
  ],
  ...overrides,
});

describe("TerraformGatewayImpl", () => {
  it("窓内に apply が無ければ null を返す", async () => {
    const store = new InMemoryAppliedInfraChangeStore();
    const gw = new TerraformGatewayImpl(store);
    expect(await gw.getAppliedDiff({ since: new Date("2026-01-01T00:00:00Z") })).toBeNull();
  });

  it("since より前の apply は窓外として無視する", async () => {
    const store = new InMemoryAppliedInfraChangeStore();
    await store.record(change(new Date("2026-01-01T00:00:00Z")));
    const gw = new TerraformGatewayImpl(store);
    expect(
      await gw.getAppliedDiff({ since: new Date("2026-01-01T00:10:00Z") }),
    ).toBeNull();
  });

  it("窓内で最新の apply を採用し、address を changedResources に導出する", async () => {
    const store = new InMemoryAppliedInfraChangeStore();
    await store.record(change(new Date("2026-01-01T00:01:00Z"), { summary: "古い" }));
    await store.record(change(new Date("2026-01-01T00:05:00Z"), { summary: "新しい", commitSha: "abc1234" }));
    const gw = new TerraformGatewayImpl(store);

    const diff = await gw.getAppliedDiff({ since: new Date("2026-01-01T00:00:00Z") });

    expect(diff?.summary).toBe("新しい");
    expect(diff?.appliedAt).toBe("2026-01-01T00:05:00.000Z");
    expect(diff?.commitSha).toBe("abc1234");
    expect(diff?.changedResources).toEqual(["google_sql_database_instance.main"]);
    expect(diff?.resourceChanges[0].attributeDeltas[0]).toEqual({
      key: "max_connections",
      before: "100",
      after: "20",
    });
  });

  it("pending plan store 未配線なら getPendingPlan は空を返す", async () => {
    const gw = new TerraformGatewayImpl(new InMemoryAppliedInfraChangeStore());
    expect(await gw.getPendingPlan()).toEqual([]);
  });

  it("pending plan store の未適用 plan を新しい順で返す", async () => {
    const pendingStore = new InMemoryPendingInfraPlanStore();
    await pendingStore.record({
      resourceChanges: [],
      plannedAt: new Date("2026-07-01T00:00:00Z"),
      summary: "古い plan",
    });
    await pendingStore.record({
      resourceChanges: [],
      plannedAt: new Date("2026-07-02T00:00:00Z"),
      summary: "新しい plan",
    });
    const gw = new TerraformGatewayImpl(
      new InMemoryAppliedInfraChangeStore(),
      pendingStore,
    );

    const plans = await gw.getPendingPlan();

    expect(plans.map((p) => p.summary)).toEqual(["新しい plan", "古い plan"]);
  });
});
