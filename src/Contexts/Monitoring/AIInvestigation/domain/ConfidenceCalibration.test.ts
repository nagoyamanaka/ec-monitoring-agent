import { describe, it, expect } from "vitest";
import { calibrateConfidence } from "./ConfidenceCalibration.js";
import { InvestigationContext } from "./InvestigationContext.js";
import { InvestigationReport } from "../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";

const baseContext: InvestigationContext = {
  errorEvent: {
    eventName: "ec.inventory.reservation_failed",
    occurredOn: "2026-07-04T07:22:17.000Z",
    payload: {},
    severity: "WARNING",
  },
  knownPatterns: [],
  similarIncidents: [],
};

function makeReport(
  overrides: Partial<ConstructorParameters<typeof InvestigationReport>[0]> = {},
): InvestigationReport {
  return new InvestigationReport({
    summary: "DBコネクションプールの枯渇が原因で在庫予約処理に遅延が生じた。",
    confidence: 0.9,
    severity: AlertSeverity.warning(),
    investigationSteps: [],
    suggestedActions: [],
    suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-07-04T07:24:14.000Z"),
    isFallback: false,
    ...overrides,
  });
}

const similarIncident = {
  eventName: "ec.inventory.reservation_failed",
  occurredOn: "2026-06-01T00:00:00.000Z",
  resolvedNote: "接続上限を引き上げて解消",
};

describe("calibrateConfidence", () => {
  it("裏付けゼロなら上限 0.4 に切り詰める（推測の域）", () => {
    const result = calibrateConfidence(makeReport({ confidence: 0.9 }), baseContext);

    expect(result).toEqual({
      signals: [],
      cap: 0.4,
      original: 0.9,
      calibrated: 0.4,
    });
  });

  it("citation を伴う実在候補との相関＋類似事例（状況証拠2つ）で上限 0.7", () => {
    const context: InvestigationContext = {
      ...baseContext,
      similarIncidents: [similarIncident],
      candidateAlerts: [
        {
          alertId: "upstream-1",
          eventName: "ec.db.connection_pool_exhausted",
          category: "INFRASTRUCTURE",
          occurredOn: "2026-07-04T07:20:50.000Z",
          summary: "DBコネクションプール枯渇",
        },
      ],
    };
    const report = makeReport({
      confidence: 0.8,
      relatedAlerts: [
        {
          alertId: "upstream-1",
          relation: "upstream",
          rationale: "起因",
          // マッパの相関ガードを通った関連＝解決済みの共有証拠 citation を必ず持つ
          citations: ["google_sql_database_instance.main"],
        },
      ],
    });

    const result = calibrateConfidence(report, context);

    expect(result.signals).toEqual(["related_alert", "similar_incident"]);
    expect(result.cap).toBe(0.7);
    expect(result.calibrated).toBe(0.7);
  });

  it("候補に実在しない alertId の relatedAlerts は裏付けに数えない", () => {
    const report = makeReport({
      confidence: 0.8,
      relatedAlerts: [
        { alertId: "ghost-1", relation: "upstream", rationale: "捏造の可能性", citations: ["e12b655"] },
      ],
    });

    const result = calibrateConfidence(report, { ...baseContext, candidateAlerts: [] });

    expect(result.signals).toEqual([]);
    expect(result.calibrated).toBe(0.4);
  });

  it("citation 無しの相関は実在候補と突合できても裏付けに数えない（タスク J1）", () => {
    const context: InvestigationContext = {
      ...baseContext,
      candidateAlerts: [
        {
          alertId: "inventory-1",
          eventName: "ec.inventory.reservation_failed",
          category: "APPLICATION",
          occurredOn: "2026-07-04T07:20:50.000Z",
          summary: "在庫予約失敗",
        },
      ],
    };
    // 共有証拠を指せない相関（旧データ・捏造の因果橋）は確信度を押し上げない
    const report = makeReport({
      confidence: 0.8,
      relatedAlerts: [
        { alertId: "inventory-1", relation: "upstream", rationale: "同時発生" },
        { alertId: "inventory-1", relation: "upstream", rationale: "同時発生", citations: [] },
      ],
    });

    const result = calibrateConfidence(report, context);

    expect(result.signals).toEqual([]);
    expect(result.calibrated).toBe(0.4);
  });

  it("報告書が原因コミット sha を引用していれば強い裏付け（上限 0.75）", () => {
    const context: InvestigationContext = {
      ...baseContext,
      infraEvidence: {
        appLogs: [],
        recentCommits: [
          {
            sha: "abc1234def",
            message: "料金計算を変更",
            author: "dev",
            committedAt: new Date("2026-07-04T06:00:00.000Z"),
          },
        ],
        collectedAt: new Date("2026-07-04T07:23:00.000Z"),
      },
    };
    const cited = calibrateConfidence(
      makeReport({
        confidence: 0.9,
        summary: "コミット ABC1234DEF の退行が原因（大文字でも一致する）。",
      }),
      context,
    );
    const notCited = calibrateConfidence(
      makeReport({ confidence: 0.9, summary: "原因はコードではない。" }),
      context,
    );

    expect(cited.signals).toEqual(["cited_commit"]);
    expect(cited.cap).toBe(0.75);
    expect(cited.calibrated).toBe(0.75);
    expect(notCited.signals).toEqual([]);
    expect(notCited.calibrated).toBe(0.4);
  });

  it("CI スキャナ由来の実在 CVE を報告書が引用していれば強い裏付け（上限 0.75）", () => {
    const context: InvestigationContext = {
      ...baseContext,
      errorEvent: {
        ...baseContext.errorEvent,
        eventName: "security.vulnerability_detected",
        payload: {
          vulnerabilities: [
            { cveId: "CVE-2021-3807", severity: "CRITICAL", package: "ansi-regex" },
            { cveId: "CVE-2022-25883", severity: "HIGH", package: "semver" },
          ],
        },
        severity: "CRITICAL",
      },
    };
    const cited = calibrateConfidence(
      makeReport({
        confidence: 0.95,
        summary:
          "依存パッケージ ansi-regex に既知の脆弱性（cve-2021-3807）が検出された（小文字でも一致する）。",
      }),
      context,
    );
    const notCited = calibrateConfidence(
      makeReport({ confidence: 0.95, summary: "依存に脆弱性が検出された。" }),
      context,
    );

    expect(cited.signals).toEqual(["verifiable_cve"]);
    expect(cited.cap).toBe(0.75);
    expect(cited.calibrated).toBe(0.75);
    // CVE が payload にあっても報告書が引用していなければ数えない（cited_commit と同型）。
    expect(notCited.signals).toEqual([]);
    expect(notCited.calibrated).toBe(0.4);
  });

  it("正規形でない cveId は payload にあっても裏付けに数えない（防御的パース）", () => {
    const context: InvestigationContext = {
      ...baseContext,
      errorEvent: {
        ...baseContext.errorEvent,
        payload: {
          vulnerabilities: [{ cveId: "GHSA-93q8-gq69-wqmw", severity: "HIGH" }],
        },
      },
    };
    const result = calibrateConfidence(
      makeReport({ confidence: 0.9, summary: "GHSA-93q8-gq69-wqmw が原因。" }),
      context,
    );

    expect(result.signals).toEqual([]);
    expect(result.calibrated).toBe(0.4);
  });

  it("既知パターン一致・Terraform 差分も強い裏付けとして数える", () => {
    const context: InvestigationContext = {
      ...baseContext,
      knownPatterns: [
        {
          name: "DB_CONNECTION_EXHAUSTION",
          description: "接続上限の引き下げで枯渇",
          eventNamePattern: "ec.inventory.reservation_failed",
        },
      ],
      infraEvidence: {
        appLogs: [],
        terraformDiff: {
          resourceChanges: [
            {
              address: "google_sql_database_instance.main",
              action: "update",
              attributeDeltas: [],
            },
          ],
          appliedAt: "2026-07-04T06:00:00.000Z",
          changedResources: ["google_sql_database_instance.main"],
          summary: "max_connections 100 → 40",
        },
        collectedAt: new Date("2026-07-04T07:23:00.000Z"),
      },
    };

    const result = calibrateConfidence(makeReport({ confidence: 0.95 }), context);

    expect(result.signals).toEqual(["known_pattern", "terraform_diff"]);
    // 0.4 + 0.35 + 0.35 = 1.1 → 天井 0.95（全部揃っても 100% は主張しない）
    expect(result.cap).toBe(0.95);
    expect(result.calibrated).toBe(0.95);
  });

  it("operatorNote（人間の指摘）は状況証拠として上限を押し上げる", () => {
    const result = calibrateConfidence(
      makeReport({ confidence: 0.9 }),
      { ...baseContext, operatorNote: "原因は外部APIのタイムアウト" },
    );

    expect(result.signals).toEqual(["operator_note"]);
    expect(result.cap).toBe(0.55);
    expect(result.calibrated).toBe(0.55);
  });

  it("自己申告が上限未満なら上げずにそのまま（下げるだけ）", () => {
    const result = calibrateConfidence(
      makeReport({ confidence: 0.3 }),
      { ...baseContext, similarIncidents: [similarIncident] },
    );

    expect(result.cap).toBe(0.55);
    expect(result.calibrated).toBe(0.3);
  });

  it("fallback レポートは補正対象外（confidence=0 の定型を保持）", () => {
    const result = calibrateConfidence(
      makeReport({ confidence: 0, isFallback: true }),
      baseContext,
    );

    expect(result.calibrated).toBe(0);
    expect(result.signals).toEqual([]);
  });
});
