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

const makeAlert = () =>
  Alert.createAsUnknown({ id: new AlertId(ALERT_ID), monitoringEvent: makeEvent() });

const makeEvidence = (): InfraEvidence => ({
  appLogs: [
    {
      timestamp: new Date("2026-01-01T00:01:00.000Z"),
      severity: "ERROR",
      message: "connection refused",
      resource: "cloudrun/ec-backend",
    },
  ],
  terraformDiff: { changedResources: ["module.db"], summary: "pool size 10→5" },
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
});
