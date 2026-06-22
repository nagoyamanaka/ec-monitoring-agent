import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetInvestigationStatusUseCase } from "./GetInvestigationStatusUseCase.js";
import { InMemoryAlertRepository } from "../../../AlertAnalysis/infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert } from "../../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { ClassificationConfidence } from "../../../AlertAnalysis/domain/AlertClassification.js";
import { ClassificationRuleKind } from "../../../AlertAnalysis/domain/classification/ClassificationRuleKind.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { MonitoringResourceNotFoundError } from "../../../AlertAnalysis/application/errors/MonitoringResourceNotFoundError.js";

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

const makeReport = () =>
  new InvestigationReport({
    summary: "DBコネクションプール枯渇の可能性",
    confidence: 0.87,
    severity: AlertSeverity.critical(),
    investigationSteps: [],
    suggestedActions: [],
    suggestedPatternName: "DB_POOL_EXHAUSTION",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:05:00.000Z"),
    isFallback: false,
  });

describe("GetInvestigationStatusUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let logger: ConsoleLogger;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
  });

  const run = () =>
    new GetInvestigationStatusUseCase(alertRepo, logger).run(new AlertId(ALERT_ID));

  it("アラートが存在しなければ MonitoringResourceNotFoundError を投げる", async () => {
    await expect(run()).rejects.toBeInstanceOf(MonitoringResourceNotFoundError);
  });

  it("未知・レポート未添付は analyzing", async () => {
    await alertRepo.save(
      Alert.createAsUnknown({ id: new AlertId(ALERT_ID), monitoringEvent: makeEvent() }),
    );

    const response = await run();

    expect(response.alertId).toBe(ALERT_ID);
    expect(response.status).toBe("analyzing");
  });

  it("調査レポート添付済みは done", async () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    }).attachInvestigationReport(makeReport());
    await alertRepo.save(alert);

    const response = await run();

    expect(response.status).toBe("done");
  });

  it("既知パターンで triage 済みは done", async () => {
    await alertRepo.save(
      Alert.createFromKnownPattern({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeEvent(),
        classification: {
          type: "known",
          source: ClassificationRuleKind.EXACT_MATCH,
          patternId: "p-1",
          patternName: "KNOWN_PATTERN",
          severity: AlertSeverity.critical(),
          confidence: ClassificationConfidence.of(1),
          matchedConditions: [],
          unmatchedConditions: [],
        },
      }),
    );

    const response = await run();

    expect(response.status).toBe("done");
  });
});
