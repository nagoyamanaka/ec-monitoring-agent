import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubmitFeedbackUseCase } from "./SubmitFeedbackUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";
import { InMemorySimilarIncidentRepository } from "../../../SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../domain/AlertSeverity.js";
import { InvestigationReport } from "../../domain/InvestigationReport.js";
import { ReviewStatus } from "../../domain/ReviewStatus.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../../domain/AlertClassification.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { Filters } from "../../../../Shared/domain/criteria/Filters.js";
import { Order } from "../../../../Shared/domain/criteria/Order.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";
const AUTO_PROMOTE_THRESHOLD = 3;

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

const makeReport = () =>
  new InvestigationReport({
    summary: "DB コネクションが枯渇していました",
    confidence: 0.9,
    severity: AlertSeverity.critical(),
    investigationSteps: ["接続数を確認"],
    suggestedActions: ["プールサイズを増やす", "リトライを実装"],
    suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:01:00.000Z"),
    isFallback: false,
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

// 指定回数だけ正解フィードバックを積んだ Alert を作る
const withCorrectFeedback = (base: Alert, count: number): Alert => {
  let alert = base;
  for (let i = 0; i < count; i++) {
    alert = alert.submitFeedback({ isCorrect: true });
  }
  return alert;
};

describe("SubmitFeedbackUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let patternRepo: InMemoryKnownErrorPatternRepository;
  let similarRepo: InMemorySimilarIncidentRepository;
  let logger: ConsoleLogger;
  let useCase: SubmitFeedbackUseCase;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    patternRepo = new InMemoryKnownErrorPatternRepository();
    similarRepo = new InMemorySimilarIncidentRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new SubmitFeedbackUseCase(
      alertRepo,
      patternRepo,
      similarRepo,
      logger,
      AUTO_PROMOTE_THRESHOLD,
    );
  });

  const findAllSimilar = () =>
    similarRepo.findSimilar(new Criteria(Filters.none(), Order.none()));

  it("Alert が存在しない場合は MonitoringResourceNotFoundError を投げる", async () => {
    await expect(
      useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true }),
    ).rejects.toBeInstanceOf(MonitoringResourceNotFoundError);
  });

  it("不正解フィードバックでは index も自動昇格もしない", async () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    }).attachInvestigationReport(makeReport());
    await alertRepo.save(withCorrectFeedback(alert, AUTO_PROMOTE_THRESHOLD));

    await useCase.run({
      alertId: new AlertId(ALERT_ID),
      isCorrect: false,
      operatorNote: "実際は別原因",
    });

    expect(await findAllSimilar()).toHaveLength(0);
    expect(await patternRepo.findAll()).toHaveLength(0);
  });

  it("正解フィードバックで ResolvedIncident をインデックス登録する", async () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    }).attachInvestigationReport(makeReport());
    await alertRepo.save(alert);

    await useCase.run({
      alertId: new AlertId(ALERT_ID),
      isCorrect: true,
      operatorNote: "プール拡張で解決",
    });

    const indexed = await findAllSimilar();
    expect(indexed).toHaveLength(1);
    expect(indexed[0].eventName).toBe("ec.some.unknown_event");
    expect(indexed[0].resolvedNote).toBe("プール拡張で解決");
  });

  it("しきい値未満では自動昇格しない", async () => {
    // count=0 → 今回のフィードバックで 1 になりしきい値 3 に届かない
    const alert = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    }).attachInvestigationReport(makeReport());
    await alertRepo.save(alert);

    await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });

    expect(await patternRepo.findAll()).toHaveLength(0);
  });

  it("しきい値到達かつ未知＋レポートありで KnownErrorPattern を自動昇格する", async () => {
    const base = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    }).attachInvestigationReport(makeReport());
    // 既に 2 回正解済み → 今回で 3 回到達
    await alertRepo.save(withCorrectFeedback(base, AUTO_PROMOTE_THRESHOLD - 1));

    await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });

    const patterns = await patternRepo.findAll();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].name).toBe("AUTO_PROMOTED_EC.SOME.UNKNOWN_EVENT");
    expect(patterns[0].eventNamePattern).toBe("ec.some.unknown_event");
    expect(patterns[0].isPromoted).toBe(true);
    expect(patterns[0].severity.value).toBe("CRITICAL");
    expect(patterns[0].suggestedAction).toBe("プールサイズを増やす\nリトライを実装");
    expect(patterns[0].payloadConditions).toHaveLength(0);
  });

  it("しきい値到達でも既知分類なら昇格しない", async () => {
    const base = Alert.createFromKnownPattern({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
      classification: makeKnownClassification(),
    }).attachInvestigationReport(makeReport());
    await alertRepo.save(withCorrectFeedback(base, AUTO_PROMOTE_THRESHOLD - 1));

    await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });

    expect(await patternRepo.findAll()).toHaveLength(0);
  });

  it("しきい値到達でも調査レポートが無ければ昇格しない", async () => {
    const base = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    });
    await alertRepo.save(withCorrectFeedback(base, AUTO_PROMOTE_THRESHOLD - 1));

    await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });

    expect(await patternRepo.findAll()).toHaveLength(0);
  });
});
