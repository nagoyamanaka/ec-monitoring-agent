import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvestigateAlertUseCase } from "./InvestigateAlertUseCase.js";
import { InMemoryAlertRepository } from "../../../AlertAnalysis/infrastructure/persistence/InMemoryAlertRepository.js";
import { Alert, AlertPrimitives } from "../../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { KnownErrorPattern } from "../../../AlertAnalysis/domain/KnownErrorPattern.js";
import { KnownErrorPatternRepository } from "../../../AlertAnalysis/domain/KnownErrorPatternRepository.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";
import { SimilarIncident } from "../../../SimilarIncident/domain/SimilarIncident.js";
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

const makeUnknownAlert = () =>
  Alert.createAsUnknown({
    id: new AlertId(ALERT_ID),
    monitoringEvent: makeUnknownEvent(),
  });

const makeReport = () =>
  new InvestigationReport({
    summary: "DBコネクションプール枯渇の可能性",
    confidence: 0.87,
    severity: AlertSeverity.critical(),
    investigationSteps: ["ログを確認", "メトリクスを確認"],
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

const makeSimilarRepo = (
  incidents: SimilarIncident[] = [],
): SimilarIncidentRepository => ({
  findSimilar: async () => incidents,
  index: async () => {},
  removeByAlertId: async () => {},
  search: async () => [],
});

describe("InvestigateAlertUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let logger: ConsoleLogger;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
  });

  // 既知パターン文脈はデフォルト空（未知調査経路のテスト）。findAll 以外は使われない。
  const emptyPatternRepo: KnownErrorPatternRepository = {
    save: async () => {},
    findById: async () => null,
    findAll: async () => [],
    removeBySourceAlertId: async () => {},
  };

  const makeUseCase = (
    port: AIInvestigationPort,
    notifier: SSEAlertNotifier,
    similarRepo: SimilarIncidentRepository = makeSimilarRepo(),
    patternRepo: KnownErrorPatternRepository = emptyPatternRepo,
  ) =>
    new InvestigateAlertUseCase(
      alertRepo,
      similarRepo,
      port,
      notifier,
      logger,
      patternRepo,
    );

  describe("Alert が存在しない（冪等性）", () => {
    it("何もせず return する（save も notify もされない）", async () => {
      const { notifier, notified } = makeSpyNotifier();
      const port: AIInvestigationPort = { investigate: vi.fn() };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      expect(port.investigate).not.toHaveBeenCalled();
      expect(notified).toHaveLength(0);
    });
  });

  describe("正常系：AI調査が成功する", () => {
    it("レポートが添付され status が OPEN で保存される", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => makeReport(),
      };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.status.value).toBe("OPEN");
      expect(saved?.investigationReport?.summary).toBe(
        "DBコネクションプール枯渇の可能性",
      );
      expect(saved?.investigationReport?.isFallback).toBe(false);
    });

    it("調査完了が SSE で notify される（裏付けゼロの確信度は 0.4 に補正）", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier, notified } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => makeReport(),
      };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      // 既知パターン・類似事例・相関・引用証拠のいずれも無い文脈では、LLM 自己申告 0.87 は
      // ConfidenceCalibration の裏付けゼロ上限（0.4）まで切り詰められる。
      expect(notified).toHaveLength(1);
      expect(notified[0].investigationReport?.confidence).toBe(0.4);
    });

    it("裏付け（既知パターン＋類似事例）があれば LLM 自己申告の確信度を保持する", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier, notified } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => makeReport(),
      };
      const matchingPatternRepo: KnownErrorPatternRepository = {
        ...emptyPatternRepo,
        findAll: async () => [
          KnownErrorPattern.create({
            id: "pat-1",
            name: "UNKNOWN_EVENT_PATTERN",
            description: "過去に確定した同型障害",
            eventNamePattern: "ec.some.unknown_event",
            payloadConditions: [],
            severity: AlertSeverity.warning(),
            suggestedAction: "接続上限を確認",
          }),
        ],
      };
      const similar: SimilarIncident = {
        id: "inc-1",
        eventName: "ec.some.unknown_event",
        occurredOn: new Date("2025-12-01T00:00:00.000Z"),
        resolvedNote: "再起動で解消",
        resolvedAt: new Date("2025-12-01T01:00:00.000Z"),
        severity: AlertSeverity.warning(),
      };
      const useCase = makeUseCase(
        port,
        notifier,
        makeSimilarRepo([similar]),
        matchingPatternRepo,
      );

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      // 既知パターン(強)＋類似事例(状況証拠)で上限 0.9 → 自己申告 0.87 はそのまま通る。
      expect(notified).toHaveLength(1);
      expect(notified[0].investigationReport?.confidence).toBe(0.87);
    });

    it("類似インシデントが InvestigationContext に渡される", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      let captured: InvestigationContext | undefined;
      const port: AIInvestigationPort = {
        investigate: async (ctx) => {
          captured = ctx;
          return makeReport();
        },
      };
      const similar: SimilarIncident = {
        id: "inc-1",
        eventName: "ec.some.unknown_event",
        occurredOn: new Date("2025-12-01T00:00:00.000Z"),
        resolvedNote: "再起動で解消",
        resolvedAt: new Date("2025-12-01T01:00:00.000Z"),
        severity: AlertSeverity.warning(),
      };
      const useCase = makeUseCase(port, notifier, makeSimilarRepo([similar]));

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      expect(captured?.similarIncidents).toHaveLength(1);
      expect(captured?.similarIncidents[0].resolvedNote).toBe("再起動で解消");
      expect(captured?.errorEvent.eventName).toBe("ec.some.unknown_event");
    });
  });

  describe("Forecast 突合キー（F2）：subject の導出", () => {
    it("保存されたレポートに suggestedPatternName 由来の subject が埋まる", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => makeReport(), // suggestedPatternName: "DB_POOL_EXHAUSTION"
      };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.investigationReport?.subject).toBe("db_pool_exhaustion");
    });

    it("レポートが既に subject を持つ場合は上書きしない", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => makeReport().withSubject("checkout"),
      };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.investigationReport?.subject).toBe("checkout");
    });

    it("fallback レポートにも category 由来の subject が埋まる", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => {
          throw new Error("Gemini API timeout");
        },
      };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.investigationReport?.isFallback).toBe(true);
      expect(saved?.investigationReport?.subject).toBe("application");
    });
  });

  describe("働きの明細（G1）：実測メトリクスの添付", () => {
    it("保存されたレポートに elapsedMs と証拠件数内訳（類似事例含む）が埋まる", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => makeReport(),
      };
      const similar: SimilarIncident = {
        id: "inc-1",
        eventName: "ec.some.unknown_event",
        occurredOn: new Date("2025-12-01T00:00:00.000Z"),
        resolvedNote: "再起動で解消",
        resolvedAt: new Date("2025-12-01T01:00:00.000Z"),
        severity: AlertSeverity.warning(),
      };
      const useCase = makeUseCase(port, notifier, makeSimilarRepo([similar]));

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const metrics = (await alertRepo.findById(new AlertId(ALERT_ID)))
        ?.investigationReport?.metrics;
      expect(metrics).toBeDefined();
      expect(metrics?.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(metrics?.evidenceCounts).toEqual({
        logs: 0,
        metrics: 0,
        terraformChanges: 0,
        commits: 0,
        similarIncidents: 1,
      });
    });

    it("fallback レポートにも実測メトリクスが埋まる（事実は温存）", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => {
          throw new Error("Gemini API timeout");
        },
      };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.investigationReport?.isFallback).toBe(true);
      expect(saved?.investigationReport?.metrics).toBeDefined();
    });
  });

  describe("調査中に届いた feedback との競合（lost update 防止）", () => {
    it("調査中に保存された feedback を、レポート添付の save が上書きしない", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier } = makeSpyNotifier();
      // 調査（数十〜100秒）中にオペレーターが承認する状況を、port 内で repo へ
      // feedback を保存して再現する（run() 冒頭で読んだ集約はこの承認を知らない）。
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

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.investigationReport).not.toBeNull();
      expect(saved?.feedback?.isCorrect).toBe(true);
      expect(saved?.feedback?.operatorNote).toBe("承認");
    });
  });

  describe("異常系：AI調査が例外を投げる", () => {
    it("fallback レポートが添付され status は OPEN で保存される", async () => {
      await alertRepo.save(makeUnknownAlert());
      const { notifier, notified } = makeSpyNotifier();
      const port: AIInvestigationPort = {
        investigate: async () => {
          throw new Error("Gemini API timeout");
        },
      };
      const useCase = makeUseCase(port, notifier);

      await useCase.run({
        alertId: new AlertId(ALERT_ID),
        monitoringEvent: makeUnknownEvent(),
      });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.investigationReport?.isFallback).toBe(true);
      expect(saved?.investigationReport?.confidence).toBe(0);
      expect(saved?.status.value).toBe("OPEN");
      expect(notified).toHaveLength(1);
    });
  });
});
