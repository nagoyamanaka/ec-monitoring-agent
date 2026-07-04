import { describe, it, expect } from "vitest";
import { collectCitableEvidenceIds } from "./CitedEvidence.js";
import type { InfraEvidence } from "./InfraEvidence.js";

describe("collectCitableEvidenceIds", () => {
  it("証拠なし（undefined・空）は空語彙＝相関は構造的に全て落ちる", () => {
    expect(collectCitableEvidenceIds(undefined)).toEqual([]);
    expect(
      collectCitableEvidenceIds({ appLogs: [], collectedAt: new Date() }),
    ).toEqual([]);
  });

  it("commit sha・terraform アドレス・メトリクス名を小文字化して集める", () => {
    const evidence: InfraEvidence = {
      appLogs: [
        {
          timestamp: new Date("2026-07-04T07:20:00.000Z"),
          severity: "ERROR",
          message: "connection refused",
          resource: "ec-backend",
        },
      ],
      recentCommits: [
        {
          sha: "E12B655abc",
          message: "perf",
          author: "dev",
          committedAt: new Date("2026-07-04T06:00:00.000Z"),
        },
      ],
      terraformDiff: {
        resourceChanges: [
          {
            address: "google_sql_database_instance.Main",
            action: "update",
            attributeDeltas: [],
          },
        ],
        appliedAt: "2026-07-04T06:00:00.000Z",
        commitSha: "740498f",
        changedResources: ["google_sql_database_instance.Main"],
        summary: "max_connections 100 → 40",
      },
      metrics: [
        {
          metricType: "run.googleapis.com/request_count_5xx",
          displayName: "5xx リクエスト数",
          latest: 120,
          max: 300,
          points: 12,
        },
      ],
      collectedAt: new Date("2026-07-04T07:23:00.000Z"),
    };

    expect(collectCitableEvidenceIds(evidence)).toEqual([
      "e12b655abc",
      "google_sql_database_instance.main",
      "740498f",
      "run.googleapis.com/request_count_5xx",
      "5xx リクエスト数",
    ]);
  });

  it("appLogs は語彙に含めない（安定 id が無く弱い歯＝捏造を通すため）", () => {
    const evidence: InfraEvidence = {
      appLogs: [
        {
          timestamp: new Date("2026-07-04T07:20:00.000Z"),
          severity: "ERROR",
          message: "timeout",
          resource: "payment-service",
        },
      ],
      collectedAt: new Date("2026-07-04T07:23:00.000Z"),
    };
    expect(collectCitableEvidenceIds(evidence)).toEqual([]);
  });
});
