import { describe, it, expect, beforeEach, vi } from "vitest";
import { RequestAlertInvestigationUseCase } from "./RequestAlertInvestigationUseCase.js";
import { InMemoryAlertRepository } from "../../../AlertAnalysis/infrastructure/persistence/InMemoryAlertRepository.js";
import { InMemoryAsyncEventBus } from "../../../../Shared/infrastructure/EventBus/InMemory/InMemoryAsyncEventBus.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { Alert } from "../../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { InvestigateAlertDomainEvent } from "../../../AlertAnalysis/domain/InvestigateAlertDomainEvent.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

const makeEvent = () =>
  new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.payment.timeout",
    aggregateId: "agg-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: { orderId: "o-1" },
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.critical(),
    source: "payment",
  });

describe("RequestAlertInvestigationUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let bus: InMemoryAsyncEventBus;
  let logger: ConsoleLogger;
  let useCase: RequestAlertInvestigationUseCase;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    bus = new InMemoryAsyncEventBus();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new RequestAlertInvestigationUseCase(alertRepo, bus, logger);
  });

  it("Alert が存在しなければ何も publish せず return する（冪等）", async () => {
    const publishSpy = vi.spyOn(bus, "publish");

    await useCase.run({ alertId: new AlertId(ALERT_ID) });

    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("既存 Alert に対して InvestigateAlertDomainEvent を publish する", async () => {
    await alertRepo.save(
      Alert.createAsUnknown({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeEvent(),
      }),
    );
    const publishSpy = vi.spyOn(bus, "publish");

    await useCase.run({ alertId: new AlertId(ALERT_ID) });

    const events = publishSpy.mock.calls.flat(2);
    const investigateEvent = events.find(
      (e) => e instanceof InvestigateAlertDomainEvent,
    ) as InvestigateAlertDomainEvent | undefined;
    expect(investigateEvent).toBeDefined();
    expect(investigateEvent?.aggregateId).toBe(ALERT_ID);
    expect(investigateEvent?.monitoringEvent.eventName).toBe("ec.payment.timeout");
  });
});
