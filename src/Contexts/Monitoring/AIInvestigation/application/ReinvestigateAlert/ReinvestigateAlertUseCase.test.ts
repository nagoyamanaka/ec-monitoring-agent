import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReinvestigateAlertUseCase } from "./ReinvestigateAlertUseCase.js";
import { InMemoryAlertRepository } from "../../../AlertAnalysis/infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert, AlertPrimitives } from "../../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";
import { SimilarIncidentRepository } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { AIInvestigationPort } from "../../domain/AIInvestigationPort.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

const makeUnknownEvent = () =>
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
    investigationSteps: ["ログを確認"],
    suggestedActions: ["接続上限を引き上げる"],
    suggestedPatternName: "DB_POOL_EXHAUSTION",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:05:00.000Z"),
    isFallback: false,
  });

const makeSpyNotifier = () => {
  const notified: AlertPrimitives[] = [];
  const notifier: SSEAlertNotifier = {
    notify: (p) => {
      notified.push(p);
    },
    notifyRemediation: () => {},
    notifyInvestigationProgress: () => {},
    addConnection: () => {},
    removeConnection: () => {},
  };
  return { notifier, notified };
};

const makeSimilarRepo = (): SimilarIncidentRepository => ({
  findSimilar: async () => [],
  index: async () => {},
  removeByAlertId: async () => {},
  search: async () => [],
});

describe("ReinvestigateAlertUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let logger: ConsoleLogger;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
  });

  const makeUseCase = (port: AIInvestigationPort, notifier: SSEAlertNotifier) =>
    new ReinvestigateAlertUseCase(
      alertRepo,
      makeSimilarRepo(),
      port,
      notifier,
      logger,
    );

  it("ANALYZING へ戻して push → 人間の指摘を文脈に載せ新レポートで再 push する", async () => {
    // 既に調査済み（OPEN＋レポート）かつ却下済みの Alert を用意
    const reviewed = Alert.createAsUnknown({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeUnknownEvent(),
    })
      .attachInvestigationReport(makeReport())
      .submitFeedback({ isCorrect: false, operatorNote: "前回は誤り" });
    await alertRepo.save(reviewed);

    const { notifier, notified } = makeSpyNotifier();
    let captured: InvestigationContext | undefined;
    const port: AIInvestigationPort = {
      investigate: async (ctx) => {
        captured = ctx;
        return makeReport();
      },
    };
    const useCase = makeUseCase(port, notifier);

    await useCase.run({
      alertId: new AlertId(ALERT_ID),
      operatorNote: "原因は在庫サービス。閾値を見直して",
    });

    // 人間の指摘が AI 文脈へ渡る
    expect(captured?.operatorNote).toBe("原因は在庫サービス。閾値を見直して");

    // 1 回目の push は再調査中（ANALYZING）、2 回目は確定（OPEN＋新レポート）
    expect(notified).toHaveLength(2);
    expect(notified[0].status).toBe("ANALYZING");
    expect(notified[1].status).toBe("OPEN");

    // 再調査後はフィードバックがクリアされ、新レポートを白紙で再レビューできる
    const saved = await alertRepo.findById(new AlertId(ALERT_ID));
    expect(saved?.status.value).toBe("OPEN");
    expect(saved?.feedback).toBeNull();
    expect(saved?.investigationReport?.summary).toBe(
      "DBコネクションプール枯渇の可能性",
    );

    // 働きの明細（G1）: 自動調査と同じ形で実測メトリクスが添付される
    expect(saved?.investigationReport?.metrics?.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(saved?.investigationReport?.metrics?.evidenceCounts).toEqual({
      logs: 0,
      metrics: 0,
      terraformChanges: 0,
      commits: 0,
      similarIncidents: 0,
    });
  });

  it("Alert が存在しなければ何もしない（冪等性）", async () => {
    const { notifier, notified } = makeSpyNotifier();
    const port: AIInvestigationPort = { investigate: vi.fn() };
    const useCase = makeUseCase(port, notifier);

    await useCase.run({
      alertId: new AlertId(ALERT_ID),
      operatorNote: "指摘",
    });

    expect(port.investigate).not.toHaveBeenCalled();
    expect(notified).toHaveLength(0);
  });

  it("再調査中に保存された feedback を、レポート添付の save が上書きしない", async () => {
    await alertRepo.save(
      Alert.createAsUnknown({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      }).attachInvestigationReport(makeReport()),
    );
    const { notifier } = makeSpyNotifier();
    // 再調査（数十〜100秒）中にオペレーターが承認する状況を、port 内で repo へ
    // feedback を保存して再現する（reopen 時点の集約はこの承認を知らない）。
    const port: AIInvestigationPort = {
      investigate: async () => {
        const current = await alertRepo.findById(new AlertId(ALERT_ID));
        await alertRepo.save(
          current!.submitFeedback({ isCorrect: true, operatorNote: "承認" }),
        );
        return makeReport();
      },
    };
    const useCase = makeUseCase(port, notifier);

    await useCase.run({ alertId: new AlertId(ALERT_ID), operatorNote: "指摘" });

    const saved = await alertRepo.findById(new AlertId(ALERT_ID));
    expect(saved?.investigationReport).not.toBeNull();
    expect(saved?.feedback?.isCorrect).toBe(true);
    expect(saved?.feedback?.operatorNote).toBe("承認");
  });

  it("AI再調査が例外を投げても fallback レポートで OPEN 保存する", async () => {
    await alertRepo.save(
      Alert.createAsUnknown({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      }).attachInvestigationReport(makeReport()),
    );
    const { notifier, notified } = makeSpyNotifier();
    const port: AIInvestigationPort = {
      investigate: async () => {
        throw new Error("Gemini timeout");
      },
    };
    const useCase = makeUseCase(port, notifier);

    await useCase.run({ alertId: new AlertId(ALERT_ID), operatorNote: "指摘" });

    const saved = await alertRepo.findById(new AlertId(ALERT_ID));
    expect(saved?.investigationReport?.isFallback).toBe(true);
    expect(saved?.status.value).toBe("OPEN");
    // ANALYZING push ＋ 確定 push の 2 回
    expect(notified).toHaveLength(2);
  });
});
