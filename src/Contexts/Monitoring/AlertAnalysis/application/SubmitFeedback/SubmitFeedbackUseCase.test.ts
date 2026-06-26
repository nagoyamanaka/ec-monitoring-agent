import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubmitFeedbackUseCase } from "./SubmitFeedbackUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";
import { InMemorySimilarIncidentRepository } from "../../../SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { InvestigationReport } from "../../domain/InvestigationReport.js";
import { ReviewStatus } from "../../domain/ReviewStatus.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../../domain/AlertClassification.js";
import { ClassificationRuleKind } from "../../domain/classification/ClassificationRuleKind.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { Filters } from "../../../../Shared/domain/criteria/Filters.js";
import { Order } from "../../../../Shared/domain/criteria/Order.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";
import { FixedThresholdPromotionPolicy } from "../../domain/promotion/FixedThresholdPromotionPolicy.js";

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
    severity: AlertSeverity.pending(),
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
  source: ClassificationRuleKind.EXACT_MATCH,
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
      new FixedThresholdPromotionPolicy(AUTO_PROMOTE_THRESHOLD),
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
    // 元アラートへの back-link を保持する（UI ディープリンク用）
    expect(indexed[0].sourceAlertId).toBe(ALERT_ID);
  });

  it("operatorNote 無しでも investigationReport.summary を resolvedNote に残す", async () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    }).attachInvestigationReport(makeReport());
    await alertRepo.save(alert);

    await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });

    const indexed = await findAllSimilar();
    expect(indexed).toHaveLength(1);
    // メモ未入力時は AI 調査 summary を記憶に残す（汎用文字列に潰さない）
    expect(indexed[0].resolvedNote).toBe("DB コネクションが枯渇していました");
  });

  it("operatorNote も investigationReport も無ければ汎用文字列にフォールバックする", async () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
    });
    await alertRepo.save(alert);

    await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });

    const indexed = await findAllSimilar();
    expect(indexed).toHaveLength(1);
    expect(indexed[0].resolvedNote).toBe("正解フィードバックによる解決");
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

  describe("再レビュー（判定のやり直し）と類似学習の整合", () => {
    it("誤承認→却下し直すと、承認時に積んだ類似学習を撤回する", async () => {
      const alert = Alert.createAsUnknown({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeEvent(),
      }).attachInvestigationReport(makeReport());
      await alertRepo.save(alert);

      // 誤承認 → index される
      await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });
      expect(await findAllSimilar()).toHaveLength(1);

      // 却下し直し → 撤回される（学習を残さない）
      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        isCorrect: false,
        operatorNote: "誤承認だった",
      });
      expect(await findAllSimilar()).toHaveLength(0);
    });

    it("自動昇格後に却下し直すと、結晶化した KnownErrorPattern も撤回する", async () => {
      const base = Alert.createAsUnknown({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeEvent(),
      }).attachInvestigationReport(makeReport());
      // しきい値直前まで積んでおき、今回の承認で自動昇格させる
      await alertRepo.save(withCorrectFeedback(base, AUTO_PROMOTE_THRESHOLD - 1));

      await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });
      const promoted = await patternRepo.findAll();
      expect(promoted).toHaveLength(1);
      expect(promoted[0].sourceAlertId).toBe(ALERT_ID);

      // 誤承認だったとして却下し直す → 結晶化を撤回
      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        isCorrect: false,
        operatorNote: "誤承認だった",
      });
      expect(await patternRepo.findAll()).toHaveLength(0);
    });

    it("誤却下→承認し直すと index され、トグルしても重複しない（承認時1件）", async () => {
      const alert = Alert.createAsUnknown({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeEvent(),
      }).attachInvestigationReport(makeReport());
      await alertRepo.save(alert);

      // 却下（index しない）
      await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: false });
      expect(await findAllSimilar()).toHaveLength(0);

      // 承認し直し → 1件 index
      await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });
      expect(await findAllSimilar()).toHaveLength(1);

      // 再承認（トグル）でも二重 index しない
      await useCase.run({ alertId: new AlertId(ALERT_ID), isCorrect: true });
      expect(await findAllSimilar()).toHaveLength(1);
    });
  });
});
