import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvestigateAlertUseCase } from "./InvestigateAlertUseCase.js";
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

  const makeUseCase = (
    port: AIInvestigationPort,
    notifier: SSEAlertNotifier,
    similarRepo: SimilarIncidentRepository = makeSimilarRepo(),
  ) =>
    new InvestigateAlertUseCase(alertRepo, similarRepo, port, notifier, logger);

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

    it("調査完了が SSE で notify される", async () => {
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
