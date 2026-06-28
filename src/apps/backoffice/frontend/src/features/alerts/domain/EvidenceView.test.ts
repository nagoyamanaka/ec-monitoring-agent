import { describe, expect, it } from "vitest";
import type { InfraEvidencePrimitives } from "@monitoring/AIInvestigation/domain/InfraEvidence";
import {
  evidenceSections,
  isEvidenceEmpty,
  toEvidenceView,
} from "./EvidenceView";

function makePrimitives(
  overrides: Partial<InfraEvidencePrimitives> = {},
): InfraEvidencePrimitives {
  return {
    appLogs: [
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        severity: "ERROR",
        message: "pool exhausted",
        resource: "ec-backend",
      },
    ],
    terraformDiff: {
      changedResources: ["aws_db_instance.main"],
      summary: "max_connections を縮小",
    },
    recentCommits: [
      {
        sha: "0123456789abcdef",
        message: "tune pool",
        author: "alice",
        committedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    collectedAt: "2026-01-01T00:00:01.000Z",
    ...overrides,
  };
}

describe("toEvidenceView", () => {
  it("primitives を View へ写像し、SHA を短縮する", () => {
    const view = toEvidenceView(makePrimitives());
    expect(view.appLogs[0]).toMatchObject({
      severity: "ERROR",
      message: "pool exhausted",
    });
    expect(view.recentCommits[0].shortSha).toBe("0123456");
    expect(view.terraformDiff?.summary).toBe("max_connections を縮小");
  });

  it("optional な terraformDiff / recentCommits / metrics 欠落を null / [] に正規化する", () => {
    const view = toEvidenceView(
      makePrimitives({
        terraformDiff: undefined,
        recentCommits: undefined,
        metrics: undefined,
      }),
    );
    expect(view.terraformDiff).toBeNull();
    expect(view.recentCommits).toEqual([]);
    expect(view.metrics).toEqual([]);
  });

  it("metrics を View へ写像する（unit 欠落は null）", () => {
    const view = toEvidenceView(
      makePrimitives({
        metrics: [
          {
            metricType: "run.googleapis.com/request_count",
            displayName: "5xx レスポンス数",
            latest: 12,
            max: 20,
            points: 5,
          },
        ],
      }),
    );
    expect(view.metrics[0]).toEqual({
      metricType: "run.googleapis.com/request_count",
      displayName: "5xx レスポンス数",
      unit: null,
      latest: 12,
      max: 20,
      points: 5,
    });
  });
});

describe("evidenceSections", () => {
  it("存在するソースのみ logs→metrics→terraform→commits の順で返す", () => {
    const sections = evidenceSections(
      toEvidenceView(
        makePrimitives({
          metrics: [
            {
              metricType: "run.googleapis.com/container/cpu/utilizations",
              displayName: "CPU 使用率",
              unit: "ratio",
              latest: 0.9,
              max: 0.95,
              points: 3,
            },
          ],
        }),
      ),
    );
    expect(sections.map((s) => s.kind)).toEqual([
      "logs",
      "metrics",
      "terraform",
      "commits",
    ]);
  });

  it("空のソースは畳む（変更リソース 0 の terraform は出さない）", () => {
    const view = toEvidenceView(
      makePrimitives({
        appLogs: [],
        terraformDiff: { changedResources: [], summary: "差分なし" },
        recentCommits: [],
      }),
    );
    expect(evidenceSections(view)).toEqual([]);
    expect(isEvidenceEmpty(view)).toBe(true);
  });
});
