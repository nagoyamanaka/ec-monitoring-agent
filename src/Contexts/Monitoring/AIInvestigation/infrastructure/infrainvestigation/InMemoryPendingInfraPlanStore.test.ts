import { describe, it, expect } from "vitest";
import { InMemoryPendingInfraPlanStore } from "./InMemoryPendingInfraPlanStore.js";
import { PendingPlan } from "./TerraformGateway.js";

const plan = (overrides: Partial<PendingPlan> = {}): PendingPlan => ({
  resourceChanges: [
    { address: "google_compute_instance.mongo", action: "update", attributeDeltas: [] },
  ],
  plannedAt: new Date("2026-07-08T10:00:00.000Z"),
  summary: "terraform plan: 1件のリソース変更・apply待ち",
  ...overrides,
});

describe("InMemoryPendingInfraPlanStore", () => {
  it("listPending は新しい順（直近 plan が先頭）で返す", async () => {
    const store = new InMemoryPendingInfraPlanStore();
    await store.record(plan({ summary: "old", plannedAt: new Date("2026-07-01T00:00:00Z") }));
    await store.record(plan({ summary: "new", plannedAt: new Date("2026-07-08T00:00:00Z") }));

    const pending = await store.listPending();
    expect(pending.map((p) => p.summary)).toEqual(["new", "old"]);
  });

  it("同一 url の record は置換（同じ PR の plan 再実行でシグナルが増殖しない）", async () => {
    const store = new InMemoryPendingInfraPlanStore();
    const url = "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/99";
    await store.record(plan({ url, summary: "1st plan" }));
    await store.record(plan({ url, summary: "2nd plan" }));

    const pending = await store.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].summary).toBe("2nd plan");
  });

  it("url なし（デモ seed と同型）は置換せず積み上がる", async () => {
    const store = new InMemoryPendingInfraPlanStore();
    await store.record(plan({ summary: "seed" }));
    await store.record(plan({ summary: "another" }));

    expect(await store.listPending()).toHaveLength(2);
  });
});
