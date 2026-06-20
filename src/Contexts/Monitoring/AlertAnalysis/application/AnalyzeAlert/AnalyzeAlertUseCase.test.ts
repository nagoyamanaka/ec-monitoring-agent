import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyzeAlertUseCase } from "./AnalyzeAlertUseCase.js";
import { InMemoryAlertRepository } from "../../infrastructure/persistence/InMemoryAlertRepository.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";
import { KnownPatternRule } from "../../domain/classification/rules/KnownPatternRule.js";
import { ClassificationRuleSorter } from "../../domain/classification/ClassificationRuleSorter.js";
import { ApplicationClassificationPolicy } from "../../domain/classification/policies/ApplicationClassificationPolicy.js";
import { PolicyBasedAlertClassifier } from "../../domain/classification/PolicyBasedAlertClassifier.js";
import { InMemoryAsyncEventBus } from "../../../../Shared/infrastructure/EventBus/InMemory/InMemoryAsyncEventBus.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { KnownErrorPattern } from "../../domain/KnownErrorPattern.js";
import { AlertSeverity } from "../../domain/AlertSeverity.js";
import { AlertId } from "../../domain/AlertId.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { InvestigateAlertDomainEvent } from "../../domain/InvestigateAlertDomainEvent.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";
import { AlertPrimitives } from "../../domain/Alert.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";

const makePaymentTimeoutEvent = () =>
  new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.payment.timeout",
    aggregateId: "payment-attempt-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: { orderId: "order-1", customerId: "cust-1", amount: 5000 },
    category: MonitoringEventCategory.application(),
    source: "payment",
  });

const makeUnknownEvent = () =>
  new MonitoringEvent({
    eventId: "evt-002",
    eventName: "ec.some.unknown_event",
    aggregateId: "agg-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: MonitoringEventCategory.application(),
    source: "unknown",
  });

const makeSpyNotifier = () => {
  const notified: AlertPrimitives[] = [];
  const notifier: SSEAlertNotifier = {
    notify: (p) => { notified.push(p); },
    addConnection: () => {},
    removeConnection: () => {},
  };
  return { notifier, notified };
};

const PAYMENT_TIMEOUT_PATTERN = KnownErrorPattern.create({
  id: "pattern-payment-timeout",
  name: "PAYMENT_TIMEOUT",
  description: "決済タイムアウト",
  eventNamePattern: "ec.payment.timeout",
  payloadConditions: [],
  severity: AlertSeverity.critical(),
  suggestedAction: "決済状態を確認する",
});

describe("AnalyzeAlertUseCase", () => {
  let alertRepo: InMemoryAlertRepository;
  let bus: InMemoryAsyncEventBus;
  let logger: ConsoleLogger;

  beforeEach(() => {
    alertRepo = new InMemoryAlertRepository();
    bus = new InMemoryAsyncEventBus();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
  });

  const makeUseCase = (patterns: KnownErrorPattern[], notifier: SSEAlertNotifier) => {
    const patternRepo = new InMemoryKnownErrorPatternRepository(patterns);
    const rule = new KnownPatternRule(patternRepo);
    const sorter = new ClassificationRuleSorter();
    const policy = new ApplicationClassificationPolicy([rule], sorter);
    const classifier = new PolicyBasedAlertClassifier([policy]);
    return new AnalyzeAlertUseCase(alertRepo, classifier, bus, notifier, logger);
  };

  describe("既知パターン一致（PAYMENT_TIMEOUT）", () => {
    it("Alert が OPEN ステータスで保存される", async () => {
      const { notifier } = makeSpyNotifier();
      const useCase = makeUseCase([PAYMENT_TIMEOUT_PATTERN], notifier);

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makePaymentTimeoutEvent() });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.status.value).toBe("OPEN");
    });

    it("KnownAlertClassification が PAYMENT_TIMEOUT で設定される", async () => {
      const { notifier } = makeSpyNotifier();
      const useCase = makeUseCase([PAYMENT_TIMEOUT_PATTERN], notifier);

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makePaymentTimeoutEvent() });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.classification.type).toBe("known");
      expect((saved?.classification as { patternName: string }).patternName).toBe("PAYMENT_TIMEOUT");
    });

    it("severity が CRITICAL になる", async () => {
      const { notifier } = makeSpyNotifier();
      const useCase = makeUseCase([PAYMENT_TIMEOUT_PATTERN], notifier);

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makePaymentTimeoutEvent() });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.severity.value).toBe("CRITICAL");
    });

    it("SSEAlertNotifier に notify される", async () => {
      const { notifier, notified } = makeSpyNotifier();
      const useCase = makeUseCase([PAYMENT_TIMEOUT_PATTERN], notifier);

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makePaymentTimeoutEvent() });

      expect(notified).toHaveLength(1);
      expect(notified[0].id).toBe(ALERT_ID);
    });

    it("InvestigateAlertDomainEvent は publish されない", async () => {
      const { notifier } = makeSpyNotifier();
      const useCase = makeUseCase([PAYMENT_TIMEOUT_PATTERN], notifier);
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makePaymentTimeoutEvent() });

      const events = publishSpy.mock.calls.flat(2);
      const investigateEvent = events.find((e) => e instanceof InvestigateAlertDomainEvent);
      expect(investigateEvent).toBeUndefined();
    });
  });

  describe("未知パターン（パターン登録なし）", () => {
    it("Alert が ANALYZING ステータスで保存される", async () => {
      const { notifier } = makeSpyNotifier();
      const useCase = makeUseCase([], notifier);

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makeUnknownEvent() });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.status.value).toBe("ANALYZING");
    });

    it("UnknownAlertClassification が設定される", async () => {
      const { notifier } = makeSpyNotifier();
      const useCase = makeUseCase([], notifier);

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makeUnknownEvent() });

      const saved = await alertRepo.findById(new AlertId(ALERT_ID));
      expect(saved?.classification.type).toBe("unknown");
    });

    it("SSEAlertNotifier に notify される（ANALYZING 状態で即時 push）", async () => {
      const { notifier, notified } = makeSpyNotifier();
      const useCase = makeUseCase([], notifier);

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makeUnknownEvent() });

      expect(notified).toHaveLength(1);
      expect(notified[0].status).toBe("ANALYZING");
    });

    it("InvestigateAlertDomainEvent が alertId 付きで publish される", async () => {
      const { notifier } = makeSpyNotifier();
      const useCase = makeUseCase([], notifier);
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run({ alertId: new AlertId(ALERT_ID), monitoringEvent: makeUnknownEvent() });

      const events = publishSpy.mock.calls.flat(2);
      const event = events.find((e) => e instanceof InvestigateAlertDomainEvent) as InvestigateAlertDomainEvent;
      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(ALERT_ID);
    });
  });
});
