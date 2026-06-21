import { describe, it, expect, beforeEach, vi } from "vitest";
import { GetAlertUseCase } from "./GetAlertUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";
const MISSING_ID = "550e8400-e29b-41d4-a716-4466554409ff";

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

const makeAlert = (id: string) =>
  Alert.createAsUnknown({
    id: new AlertId(id),
    monitoringEvent: makeEvent(),
  });

describe("GetAlertUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let logger: ConsoleLogger;
  let useCase: GetAlertUseCase;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new GetAlertUseCase(alertRepo, logger);
  });

  it("Alert が存在しない場合は MonitoringResourceNotFoundError を投げる", async () => {
    await expect(useCase.run(new AlertId(MISSING_ID))).rejects.toBeInstanceOf(
      MonitoringResourceNotFoundError,
    );
  });

  it("Alert 未存在時は warn ログを書き込む", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockResolvedValue(undefined);

    await expect(useCase.run(new AlertId(MISSING_ID))).rejects.toThrow();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatchObject({
      action: "get_alert_not_found",
    });
  });

  it("存在する Alert を 1 件の AlertResponse として返す", async () => {
    await alertRepo.save(makeAlert(ALERT_ID));

    const response = await useCase.run(new AlertId(ALERT_ID));

    expect(response.alerts).toHaveLength(1);
    expect(response.alerts[0].id).toBe(ALERT_ID);
  });
});
