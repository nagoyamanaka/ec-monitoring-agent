import { describe, it, expect, beforeEach } from "vitest";
import { GetAnalyticsUseCase } from "./GetAnalyticsUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../../domain/AlertClassification.js";
import { ClassificationRuleKind } from "../../domain/classification/ClassificationRuleKind.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { InvestigationReport } from "../../domain/InvestigationReport.js";
import { ReviewStatus } from "../../domain/ReviewStatus.js";

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
    severity: AlertSeverity.pending(),
    source: "unknown",
  });

const makeKnownClassification = (): KnownAlertClassification => ({
  type: "known",
  source: ClassificationRuleKind.EXACT_MATCH,
  patternId: "pattern-1",
  patternName: "PAYMENT_TIMEOUT",
  severity: AlertSeverity.critical(),
  confidence: ClassificationConfidence.certain(),
  matchedConditions: [],
  unmatchedConditions: [],
});

const makeUnknownAlert = () =>
  Alert.createAsUnknown({ id: new AlertId(nextId()), monitoringEvent: makeEvent() });

// LLM 出力の途中切断→salvage を再現: summary は回収できたが suggestedPatternName に
// 到達する前に切れて "" に丸められた、isFallback=false の部分レポート（シナリオ4で頻発）。
const makeSalvagedReport = () =>
  new InvestigationReport({
    summary: "脆弱性を検出（部分回収）",
    confidence: 0.8,
    severity: AlertSeverity.critical(),
    investigationSteps: [],
    suggestedActions: [],
    suggestedPatternName: "", // ← 切断で欠落
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:00:00.000Z"),
    isFallback: false,
  });

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

  it("承認済み（正解フィードバック）のみ approvedAlerts に載せる", async () => {
    await alertRepo.save(
      makeKnownAlert().submitFeedback({ isCorrect: true, operatorNote: "既知どおり" }),
    );
    await alertRepo.save(makeKnownAlert().submitFeedback({ isCorrect: false })); // 却下は載せない
    await alertRepo.save(makeUnknownAlert()); // 未レビューは載せない

    const response = await useCase.run();

    expect(response.approvedAlerts).toHaveLength(1);
    const summary = response.approvedAlerts[0];
    expect(summary.eventName).toBe("ec.some.unknown_event");
    expect(summary.classificationType).toBe("known");
    expect(summary.patternName).toBe("PAYMENT_TIMEOUT");
    expect(summary.operatorNote).toBe("既知どおり");
    expect(summary.category).toBe("APPLICATION");
  });

  it("空の suggestedPatternName（salvage 欠落）は patternName を null に畳む", async () => {
    // シナリオ4: 途中切断で推定パターン名が欠落した未知アラートを承認クローズしたケース。
    const salvaged = makeUnknownAlert()
      .attachInvestigationReport(makeSalvagedReport())
      .submitFeedback({ isCorrect: true });
    await alertRepo.save(salvaged);

    const response = await useCase.run();

    expect(response.approvedAlerts).toHaveLength(1);
    // "" のまま漏らすと UI が「AI推定: 」の後を空欄で描く。null に畳めば placeholder に倒せる。
    expect(response.approvedAlerts[0].patternName).toBeNull();
  });
});
