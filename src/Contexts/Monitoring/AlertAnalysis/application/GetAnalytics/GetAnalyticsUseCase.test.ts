import { describe, it, expect, beforeEach } from "vitest";
import { GetAnalyticsUseCase } from "./GetAnalyticsUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../domain/AlertSeverity.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../../domain/AlertClassification.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";

let seq = 0;
const nextId = () =>
  `550e8400-e29b-41d4-a716-${(446655440000 + seq++).toString().padStart(12, "0")}`;

const makeEvent = () =>
  new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.some.unknown_event",
    aggregateId: "agg-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: MonitoringEventCategory.application(),
    source: "unknown",
  });

const makeKnownClassification = (): KnownAlertClassification => ({
  type: "known",
  patternId: "pattern-1",
  patternName: "PAYMENT_TIMEOUT",
  severity: AlertSeverity.critical(),
  confidence: ClassificationConfidence.certain(),
  matchedConditions: [],
  unmatchedConditions: [],
});

const makeUnknownAlert = () =>
  Alert.createAsUnknown({ id: new AlertId(nextId()), monitoringEvent: makeEvent() });

const makeKnownAlert = () =>
  Alert.createFromKnownPattern({
    id: new AlertId(nextId()),
    monitoringEvent: makeEvent(),
    classification: makeKnownClassification(),
  });

describe("GetAnalyticsUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let useCase: GetAnalyticsUseCase;

  beforeEach(() => {
    seq = 0;
    alertRepo = new InMemoryAlertRepository();
    useCase = new GetAnalyticsUseCase(alertRepo);
  });

  it("Alert が無い場合は全カウント0・accuracy は null", async () => {
    const response = await useCase.run();

    expect(response.totalAlerts).toBe(0);
    expect(response.knownCount).toBe(0);
    expect(response.unknownCount).toBe(0);
    expect(response.withFeedbackCount).toBe(0);
    expect(response.accuracy).toBeNull();
  });

  it("known / unknown を分類別に集計する", async () => {
    await alertRepo.save(makeKnownAlert());
    await alertRepo.save(makeKnownAlert());
    await alertRepo.save(makeUnknownAlert());

    const response = await useCase.run();

    expect(response.totalAlerts).toBe(3);
    expect(response.knownCount).toBe(2);
    expect(response.unknownCount).toBe(1);
  });

  it("フィードバック未着なら accuracy は null（0除算回避）", async () => {
    await alertRepo.save(makeKnownAlert());

    const response = await useCase.run();

    expect(response.withFeedbackCount).toBe(0);
    expect(response.accuracy).toBeNull();
  });

  it("正解/不正解フィードバックから accuracy を算出する", async () => {
    await alertRepo.save(makeKnownAlert().submitFeedback({ isCorrect: true }));
    await alertRepo.save(makeKnownAlert().submitFeedback({ isCorrect: true }));
    await alertRepo.save(makeKnownAlert().submitFeedback({ isCorrect: false }));
    await alertRepo.save(makeUnknownAlert()); // フィードバック無しは母数に含めない

    const response = await useCase.run();

    expect(response.withFeedbackCount).toBe(3);
    expect(response.correctCount).toBe(2);
    expect(response.incorrectCount).toBe(1);
    expect(response.accuracy).toBeCloseTo(2 / 3);
  });
});
