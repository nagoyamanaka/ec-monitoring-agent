import { describe, it, expect, beforeEach } from "vitest";
import { GetAlertReportUseCase } from "./GetAlertReportUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";

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

describe("GetAlertReportUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let useCase: GetAlertReportUseCase;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    useCase = new GetAlertReportUseCase(alertRepo);
  });

  it("Alert が無い場合は空の AlertResponse を返す", async () => {
    const response = await useCase.run();

    expect(response.alerts).toHaveLength(0);
  });

  it("保存済みの全 Alert を AlertResponse として返す", async () => {
    await alertRepo.save(makeAlert("550e8400-e29b-41d4-a716-446655440001"));
    await alertRepo.save(makeAlert("550e8400-e29b-41d4-a716-446655440002"));

    const response = await useCase.run();

    expect(response.alerts).toHaveLength(2);
    expect(response.alerts.map((a) => a.id).sort()).toEqual([
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
    ]);
  });
});
