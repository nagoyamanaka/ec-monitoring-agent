import { describe, it, expect } from "vitest";
import { buildInvestigationMetrics } from "./InvestigationMetrics.js";
import { InvestigationContext } from "./InvestigationContext.js";

const baseContext: InvestigationContext = {
  errorEvent: {
    eventName: "ec.db.connection_pool_exhausted",
    occurredOn: "2026-07-01T00:00:00.000Z",
    payload: {},
    severity: "CRITICAL",
  },
  knownPatterns: [],
  similarIncidents: [],
};

describe("buildInvestigationMetrics", () => {
  it("infraEvidence 無しでも 0 件内訳で組み立てる（類似事例のみ計上）", () => {
    const metrics = buildInvestigationMetrics(
      {
        ...baseContext,
        similarIncidents: [
          {
            eventName: "ec.db.connection_pool_exhausted",
            occurredOn: "2026-06-01T00:00:00.000Z",
            resolvedNote: "接続上限を引き上げ",
          },
        ],
      },
      1234,
    );

    expect(metrics).toEqual({
      elapsedMs: 1234,
      evidenceCounts: {
        logs: 0,
        metrics: 0,
        terraformChanges: 0,
        commits: 0,
        similarIncidents: 1,
      },
    });
  });

  it("infraEvidence の各ソース件数を deterministic に数える", () => {
    const metrics = buildInvestigationMetrics(
      {
        ...baseContext,
        infraEvidence: {
          appLogs: [
            {
              timestamp: new Date("2026-07-01T00:00:00.000Z"),
              severity: "ERROR",
              message: "too many connections",
              resource: "cloudsql",
            },
            {
              timestamp: new Date("2026-07-01T00:00:01.000Z"),
              severity: "WARNING",
              message: "pool saturated",
              resource: "backend",
            },
          ],
          terraformDiff: {
            resourceChanges: [
              {
                address: "google_sql_database_instance.main",
                action: "update",
                attributeDeltas: [],
              },
            ],
            appliedAt: "2026-06-30T00:00:00.000Z",
            changedResources: ["google_sql_database_instance.main"],
            summary: "max_connections 100 → 40",
          },
          recentCommits: [
            {
              sha: "abc1234",
              message: "shrink pool",
              author: "dev",
              committedAt: new Date("2026-06-30T00:00:00.000Z"),
            },
          ],
          metrics: [
            {
              metricType: "cloudsql.googleapis.com/database/postgresql/num_backends",
              displayName: "接続数",
              latest: 40,
              max: 40,
              points: 12,
            },
          ],
          collectedAt: new Date("2026-07-01T00:00:05.000Z"),
        },
      },
      92_000,
    );

    expect(metrics.elapsedMs).toBe(92_000);
    expect(metrics.evidenceCounts).toEqual({
      logs: 2,
      metrics: 1,
      terraformChanges: 1,
      commits: 1,
      similarIncidents: 0,
    });
  });
});
