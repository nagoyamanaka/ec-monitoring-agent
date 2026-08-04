import { describe, it, expect } from "vitest";
import { buildCitationCoverage } from "./CitationCoverage.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { InvestigationReport } from "../../domain/InvestigationReport.js";
import { ReviewStatus } from "../../domain/ReviewStatus.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { Uuid } from "../../../../Shared/domain/value-object/Uuid.js";
import type {
  CitationRefPrimitives,
  EscalationDraftPrimitives,
  ImpactAssessmentPrimitives,
} from "../../domain/contracts/AlertContract.js";

const makeEvent = () =>
  new MonitoringEvent({
    eventId: Uuid.random().value,
    eventName: "ec.db.connection_pool_exhausted",
    aggregateId: "db-001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: MonitoringEventCategory.infrastructure(),
    severity: AlertSeverity.critical(),
    source: "cloud-monitoring",
  });

const makeReport = (params: {
  impact?: ImpactAssessmentPrimitives;
  escalation?: EscalationDraftPrimitives;
}) =>
  new InvestigationReport({
    summary: "接続プールが枯渇しました",
    confidence: 0.75,
    severity: AlertSeverity.critical(),
    investigationSteps: [],
    suggestedActions: [],
    suggestedPatternName: "DB_CONNECTION_POOL_EXHAUSTED",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:01:00.000Z"),
    isFallback: false,
    ...params,
  });

const makeImpact = (
  citations: string[],
  citationRefs?: CitationRefPrimitives[],
): ImpactAssessmentPrimitives => ({
  fault: "own",
  scope: "決済 API",
  scale: "エラー率 12%",
  affectedSubjects: ["checkout"],
  citations,
  ...(citationRefs ? { citationRefs } : {}),
});

const makeEscalation = (
  evidenceBundle: string[],
  evidenceBundleRefs?: CitationRefPrimitives[],
): EscalationDraftPrimitives => ({
  team: "SRE",
  owner: "oncall",
  contact: "#sre",
  reason: "外部プロバイダ起因",
  interimWorkaround: "フェイルオーバー",
  severityRationale: "CRITICAL 相当",
  evidenceBundle,
  ...(evidenceBundleRefs ? { evidenceBundleRefs } : {}),
});

const alertWith = (report: InvestigationReport | null): Alert => {
  const alert = Alert.createAsUnknown({
    id: new AlertId(Uuid.random().value),
    monitoringEvent: makeEvent(),
  });
  return report === null ? alert : alert.attachInvestigationReport(report);
};

describe("buildCitationCoverage", () => {
  it("引用が無ければ全て0（0除算の材料を作らない）", () => {
    const coverage = buildCitationCoverage([alertWith(null)]);

    expect(coverage).toEqual({ total: 0, resolved: 0, byKind: [], unmeasured: 0 });
  });

  it("未照合の引用は分子から外し、分母には残す", () => {
    const impact = makeImpact(
      ["abc1234", "PR #999", "CVE-2026-0001"],
      [
        { value: "abc1234", kind: "commit" },
        { value: "PR #999" }, // カタログに解決しなかった＝未照合
        { value: "CVE-2026-0001", kind: "cve" },
      ],
    );

    const coverage = buildCitationCoverage([alertWith(makeReport({ impact }))]);

    expect(coverage.total).toBe(3);
    expect(coverage.resolved).toBe(2);
    expect(coverage.unmeasured).toBe(0);
  });

  it("impact と escalation の引用を合算し、種別内訳を件数降順で返す", () => {
    const impact = makeImpact(
      ["module.db.instance", "abc1234"],
      [
        { value: "module.db.instance", kind: "terraform" },
        { value: "abc1234", kind: "commit" },
      ],
    );
    const escalation = makeEscalation(
      ["module.db.pool"],
      [{ value: "module.db.pool", kind: "terraform" }],
    );

    const coverage = buildCitationCoverage([
      alertWith(makeReport({ impact, escalation })),
    ]);

    expect(coverage.total).toBe(3);
    expect(coverage.resolved).toBe(3);
    expect(coverage.byKind).toEqual([
      { kind: "terraform", count: 2 },
      { kind: "commit", count: 1 },
    ]);
  });

  it("照合結果が未保存の旧データは分母にも分子にも入れず件数だけ残す", () => {
    // 「解決しなかった」ではなく「測っていない」＝率を悪くも良くもしない。
    const legacy = makeImpact(["abc1234", "def5678"]); // citationRefs なし

    const coverage = buildCitationCoverage([alertWith(makeReport({ impact: legacy }))]);

    expect(coverage.total).toBe(0);
    expect(coverage.resolved).toBe(0);
    expect(coverage.unmeasured).toBe(2);
  });

  it("複数アラートの引用を引用単位で足し上げる（母数はアラート数ではない）", () => {
    const first = makeImpact(["abc1234"], [{ value: "abc1234", kind: "commit" }]);
    const second = makeImpact(
      ["def5678", "ghi9012"],
      [{ value: "def5678", kind: "commit" }, { value: "ghi9012" }],
    );

    const coverage = buildCitationCoverage([
      alertWith(makeReport({ impact: first })),
      alertWith(makeReport({ impact: second })),
      alertWith(null),
    ]);

    // アラート3件・引用3件＝1アラートが複数の n を生む。
    expect(coverage.total).toBe(3);
    expect(coverage.resolved).toBe(2);
  });
});
