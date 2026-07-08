import { describe, it, expect } from "vitest";
import {
  InvalidTerraformPlanError,
  TerraformPlanTranslator,
} from "./TerraformPlanTranslator.js";

const body = (overrides: Record<string, unknown> = {}) => ({
  resourceChanges: [
    {
      address: "google_compute_instance.mongo",
      action: "update",
      attributeDeltas: [
        { key: "machine_type", before: "e2-small", after: "e2-medium" },
      ],
    },
  ],
  plannedAt: "2026-07-08T10:00:00.000Z",
  summary: "terraform plan（PR #99）: 1件のリソース変更・apply待ち",
  url: "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/99",
  ...overrides,
});

describe("TerraformPlanTranslator", () => {
  it("正規化済みボディを PendingPlan へ変換する（url・plannedAt・deltas を保持）", () => {
    const plan = TerraformPlanTranslator.toPendingPlan(body());

    expect(plan.resourceChanges).toEqual([
      {
        address: "google_compute_instance.mongo",
        action: "update",
        attributeDeltas: [
          { key: "machine_type", before: "e2-small", after: "e2-medium" },
        ],
      },
    ]);
    expect(plan.plannedAt.toISOString()).toBe("2026-07-08T10:00:00.000Z");
    expect(plan.summary).toBe("terraform plan（PR #99）: 1件のリソース変更・apply待ち");
    expect(plan.url).toBe(
      "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/99",
    );
  });

  it("resourceChanges が空/欠落なら InvalidTerraformPlanError", () => {
    expect(() =>
      TerraformPlanTranslator.toPendingPlan(body({ resourceChanges: [] })),
    ).toThrow(InvalidTerraformPlanError);
    expect(() => TerraformPlanTranslator.toPendingPlan({})).toThrow(
      InvalidTerraformPlanError,
    );
  });

  it("address 欠落・不正 action は InvalidTerraformPlanError", () => {
    expect(() =>
      TerraformPlanTranslator.toPendingPlan(
        body({ resourceChanges: [{ action: "update" }] }),
      ),
    ).toThrow(InvalidTerraformPlanError);
    expect(() =>
      TerraformPlanTranslator.toPendingPlan(
        body({ resourceChanges: [{ address: "a.b", action: "no-op" }] }),
      ),
    ).toThrow(InvalidTerraformPlanError);
  });

  it("plannedAt 不正/欠落は受領時刻で代用し 400 にしない", () => {
    const before = Date.now();
    const plan = TerraformPlanTranslator.toPendingPlan(body({ plannedAt: "not-a-date" }));
    expect(plan.plannedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("summary 欠落は差分から導出・http(s) 以外の url は落とす", () => {
    const plan = TerraformPlanTranslator.toPendingPlan(
      body({
        summary: undefined,
        url: "javascript:alert(1)",
        resourceChanges: [
          { address: "google_compute_instance.mongo", action: "update" },
          { address: "google_cloud_run_service.edge", action: "replace" },
        ],
      }),
    );
    expect(plan.summary).toBe(
      "terraform plan: 2件のリソース変更（google_compute_instance.mongo 他）・apply待ち",
    );
    expect(plan.url).toBeUndefined();
  });

  it("attributeDeltas は非文字列を JSON 文字列化し、上限（20件・200字）で切る", () => {
    const plan = TerraformPlanTranslator.toPendingPlan(
      body({
        resourceChanges: [
          {
            address: "a.b",
            action: "update",
            attributeDeltas: [
              { key: "labels", before: { env: "prod" }, after: null },
              { key: "long", before: "x".repeat(300), after: "y" },
              ...Array.from({ length: 30 }, (_, i) => ({
                key: `k${i}`,
                before: "1",
                after: "2",
              })),
            ],
          },
        ],
      }),
    );
    const deltas = plan.resourceChanges[0].attributeDeltas;
    expect(deltas).toHaveLength(20);
    expect(deltas[0]).toEqual({ key: "labels", before: '{"env":"prod"}', after: null });
    expect(deltas[1].before).toHaveLength(201); // 200字＋省略記号
    expect(deltas[1].before?.endsWith("…")).toBe(true);
  });
});
