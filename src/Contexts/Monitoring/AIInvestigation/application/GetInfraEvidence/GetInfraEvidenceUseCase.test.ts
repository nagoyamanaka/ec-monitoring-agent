import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetInfraEvidenceUseCase } from "./GetInfraEvidenceUseCase.js";
import { InMemoryAlertRepository } from "../../../AlertAnalysis/infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert } from "../../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { MonitoringResourceNotFoundError } from "../../../AlertAnalysis/application/errors/MonitoringResourceNotFoundError.js";
import { InfraInvestigationPort } from "../../domain/InfraInvestigationPort.js";
import { InfraEvidence } from "../../domain/InfraEvidence.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

const makeEvent = () =>
  new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.some.unknown_event",
    aggregateId: "agg-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: { foo: "bar" },
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.pending(),
    source: "unknown",
  });

// 直近コミット abc123 を「原因」として引用する報告書を持つアラート。
// 証拠パネルは AI が引用したコミットだけ表示するため、引用が無いとコミットは落ちる。
const makeReport = (citations: string[]) =>
  new InvestigationReport({
    summary: "調査要約",
    confidence: 0.8,
    severity: AlertSeverity.warning(),
    investigationSteps: [],
    suggestedActions: [],
    suggestedPatternName: "PATTERN",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:03:00.000Z"),
    isFallback: false,
    impact: {
      fault: "own",
      scope: "注文処理",
      scale: "数件",
      affectedSubjects: ["order"],
      citations,
    },
  });

const makeAlert = (citations: string[] = ["abc123"]) =>
  Alert.createAsUnknown({
    id: new AlertId(ALERT_ID),
    monitoringEvent: makeEvent(),
  }).attachInvestigationReport(makeReport(citations));

const makeEvidence = (): InfraEvidence => ({
  appLogs: [
    {
      timestamp: new Date("2026-01-01T00:01:00.000Z"),
      severity: "ERROR",
      message: "connection refused",
      resource: "cloudrun/ec-backend",
    },
  ],
  terraformDiff: {
    resourceChanges: [
      {
        address: "module.db",
        action: "update",
        attributeDeltas: [{ key: "pool_size", before: "10", after: "5" }],
      },
    ],
    appliedAt: "2026-01-01T00:00:10.000Z",
    changedResources: ["module.db"],
    summary: "pool size 10→5",
  },
  recentCommits: [
    {
      sha: "abc123",
      message: "tune db pool",
      author: "dev",
      committedAt: new Date("2026-01-01T00:00:30.000Z"),
    },
  ],
  collectedAt: new Date("2026-01-01T00:02:00.000Z"),
});

describe("GetInfraEvidenceUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let logger: ConsoleLogger;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
  });

  it("アラートが存在しなければ MonitoringResourceNotFoundError を投げる", async () => {
    const port: InfraInvestigationPort = { collect: vi.fn() };
    const useCase = new GetInfraEvidenceUseCase(alertRepo, port, logger);

    await expect(useCase.run(new AlertId(ALERT_ID))).rejects.toBeInstanceOf(
      MonitoringResourceNotFoundError,
    );
    expect(port.collect).not.toHaveBeenCalled();
  });

  it("アラートの monitoringEvent で証拠を再収集し、Date を ISO 文字列に正規化して返す", async () => {
    const alert = makeAlert();
    await alertRepo.save(alert);
    const collect = vi.fn().mockResolvedValue(makeEvidence());
    const port: InfraInvestigationPort = { collect };
    const useCase = new GetInfraEvidenceUseCase(alertRepo, port, logger);

    const response = await useCase.run(new AlertId(ALERT_ID));

    expect(collect).toHaveBeenCalledWith(alert.monitoringEvent);
    expect(response.evidence.collectedAt).toBe("2026-01-01T00:02:00.000Z");
    expect(response.evidence.appLogs[0].timestamp).toBe("2026-01-01T00:01:00.000Z");
    expect(response.evidence.recentCommits?.[0].committedAt).toBe(
      "2026-01-01T00:00:30.000Z",
    );
    expect(response.evidence.terraformDiff?.summary).toBe("pool size 10→5");
  });

  it("AI が引用していないコミットは証拠から落とす（原因でないコミットは出さない）", async () => {
    const alert = makeAlert(["別件の terraform 差分"]); // abc123 を引用しない
    await alertRepo.save(alert);
    const collect = vi.fn().mockResolvedValue(makeEvidence());
    const port: InfraInvestigationPort = { collect };
    const useCase = new GetInfraEvidenceUseCase(alertRepo, port, logger);

    const response = await useCase.run(new AlertId(ALERT_ID));

    expect(response.evidence.recentCommits).toBeUndefined();
    // コミット以外の証拠（ログ・terraform）はそのまま残る。
    expect(response.evidence.appLogs).toHaveLength(1);
    expect(response.evidence.terraformDiff?.summary).toBe("pool size 10→5");
  });
});
