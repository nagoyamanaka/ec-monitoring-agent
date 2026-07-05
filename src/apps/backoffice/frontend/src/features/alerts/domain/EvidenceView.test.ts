import { describe, expect, it } from "vitest";
import type { InfraEvidencePrimitives } from "@monitoring/AIInvestigation/domain/contracts/InfraEvidenceContract";
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
      resourceChanges: [
        {
          address: "aws_db_instance.main",
          action: "update",
          attributeDeltas: [
            { key: "max_connections", before: "100", after: "20" },
          ],
        },
      ],
      appliedAt: "2026-01-01T00:00:00.000Z",
      changedResources: ["aws_db_instance.main"],
      summary: "max_connections を縮小",
    },
    recentCommits: [
      {
        sha: "0123456789abcdef",
        message: "tune pool",
        author: "alice",
        committedAt: "2026-01-01T00:00:00.000Z",
        url: "https://github.com/o/r/commit/0123456789abcdef",
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
    // コミットの Web リンクは View に透過する（フロントで sha をクリック可能にする）。
    expect(view.recentCommits[0].url).toBe(
      "https://github.com/o/r/commit/0123456789abcdef",
    );
    expect(view.terraformDiff?.summary).toBe("max_connections を縮小");
    // 構造化された resourceChanges（before→after）が写像される。
    expect(view.terraformDiff?.resourceChanges[0]).toEqual({
      address: "aws_db_instance.main",
      action: "update",
      attributeDeltas: [{ key: "max_connections", before: "100", after: "20" }],
    });
    // 由来 PR リンク未提供は null（非リンク表示）。
    expect(view.terraformDiff?.url).toBeNull();
  });

  it("terraformDiff の由来 PR リンクは View に透過する（証拠の原典をクリック可能にする）", () => {
    const base = makePrimitives();
    const view = toEvidenceView(
      makePrimitives({
        terraformDiff: {
          ...base.terraformDiff!,
          url: "https://github.com/o/r/pull/30",
        },
      }),
    );
    expect(view.terraformDiff?.url).toBe("https://github.com/o/r/pull/30");
  });

  it("コミットの関連 PR リンク（原因/修正）は View に透過する（次アクションへ橋渡し）", () => {
    const base = makePrimitives();
    const view = toEvidenceView(
      makePrimitives({
        recentCommits: [
          {
            ...base.recentCommits![0],
            relatedPullRequests: [
              { url: "https://github.com/o/r/pull/62", label: "原因PR（マージ済）" },
              { url: "https://github.com/o/r/pull/63", label: "revert PR" },
            ],
          },
        ],
      }),
    );
    expect(view.recentCommits[0].relatedPullRequests).toEqual([
      { url: "https://github.com/o/r/pull/62", label: "原因PR（マージ済）" },
      { url: "https://github.com/o/r/pull/63", label: "revert PR" },
    ]);
  });

  it("関連 PR リンク未提供のコミットは relatedPullRequests を持たない", () => {
    const view = toEvidenceView(makePrimitives());
    expect(view.recentCommits[0].relatedPullRequests).toBeUndefined();
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

  it("securityFindings があれば先頭に security セクションを積む（SECURITY 検知の主証拠）", () => {
    const finding = {
      cveId: "CVE-2021-3807",
      severity: "CRITICAL",
      package: "ansi-regex",
      version: "3.0.0",
      fixedVersion: "5.0.1",
      nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2021-3807",
    };
    const sections = evidenceSections(toEvidenceView(makePrimitives()), [finding]);
    expect(sections.map((s) => s.kind)).toEqual([
      "security",
      "logs",
      "terraform",
      "commits",
    ]);
    expect(sections[0]).toEqual({ kind: "security", findings: [finding] });
  });

  it("空のソースは畳む（変更リソース 0 の terraform は出さない）", () => {
    const view = toEvidenceView(
      makePrimitives({
        appLogs: [],
        terraformDiff: {
          resourceChanges: [],
          appliedAt: "2026-01-01T00:00:00.000Z",
          changedResources: [],
          summary: "差分なし",
        },
        recentCommits: [],
      }),
    );
    expect(evidenceSections(view)).toEqual([]);
    expect(isEvidenceEmpty(view)).toBe(true);
  });
});
