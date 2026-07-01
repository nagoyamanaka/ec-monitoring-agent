import { describe, it, expect, beforeEach, vi } from "vitest";
import { PromoteAlertUseCase } from "./PromoteAlertUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { InvestigationReport } from "../../domain/InvestigationReport.js";
import { ReviewStatus } from "../../domain/ReviewStatus.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";
import { AlertNotPromotableError } from "../errors/AlertNotPromotableError.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

const makeEvent = () =>
  new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.some.unknown_event",
    aggregateId: "agg-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.pending(),
    source: "unknown",
  });

const makeReport = (isFallback = false) =>
  new InvestigationReport({
    summary: "DB コネクションが枯渇していました",
    confidence: 0.9,
    severity: AlertSeverity.critical(),
    investigationSteps: ["接続数を確認"],
    suggestedActions: ["プールサイズを増やす"],
    suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:01:00.000Z"),
    isFallback,
  });

const makeUnknownAlertWithReport = (isFallback = false): Alert =>
  Alert.createAsUnknown({
    id: new AlertId(ALERT_ID),
    monitoringEvent: makeEvent(),
  }).attachInvestigationReport(makeReport(isFallback));

describe("PromoteAlertUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let patternRepo: InMemoryKnownErrorPatternRepository;
  let logger: ConsoleLogger;
  let useCase: PromoteAlertUseCase;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    patternRepo = new InMemoryKnownErrorPatternRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new PromoteAlertUseCase(alertRepo, patternRepo, logger);
  });

  it("Alert が存在しない場合は MonitoringResourceNotFoundError を投げる", async () => {
    await expect(
      useCase.run({ alertId: new AlertId(ALERT_ID) }),
    ).rejects.toBeInstanceOf(MonitoringResourceNotFoundError);
  });

  it("調査レポートが無い Alert は AlertNotPromotableError で弾く", async () => {
    await alertRepo.save(
      Alert.createAsUnknown({ id: new AlertId(ALERT_ID), monitoringEvent: makeEvent() }),
    );

    await expect(
      useCase.run({ alertId: new AlertId(ALERT_ID) }),
    ).rejects.toBeInstanceOf(AlertNotPromotableError);
  });

  it("fallback レポートの Alert も AlertNotPromotableError で弾く", async () => {
    await alertRepo.save(makeUnknownAlertWithReport(true));

    await expect(
      useCase.run({ alertId: new AlertId(ALERT_ID) }),
    ).rejects.toBeInstanceOf(AlertNotPromotableError);
  });

  it("有効なレポートを持つ Alert を回数不問で既知パターンへ結晶化する", async () => {
    await alertRepo.save(makeUnknownAlertWithReport());

    await useCase.run({ alertId: new AlertId(ALERT_ID) });

    const patterns = await patternRepo.findAll();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].name).toBe("PROMOTED_EC.SOME.UNKNOWN_EVENT");
    expect(patterns[0].eventNamePattern).toBe("ec.some.unknown_event");
    expect(patterns[0].isPromoted).toBe(true);
    // 承認撤回で結晶化を撤回できるよう由来 Alert を保持する
    expect(patterns[0].sourceAlertId).toBe(ALERT_ID);
  });
});
