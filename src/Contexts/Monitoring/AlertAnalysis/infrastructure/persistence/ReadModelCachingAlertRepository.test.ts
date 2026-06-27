import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReadModelCachingAlertRepository } from "./ReadModelCachingAlertRepository.js";
import { AlertReadModelStore } from "../readmodel/AlertReadModelStore.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../../domain/AlertClassification.js";
import { ClassificationRuleKind } from "../../domain/classification/ClassificationRuleKind.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { Filters } from "../../../../Shared/domain/criteria/Filters.js";
import { Filter } from "../../../../Shared/domain/criteria/Filter.js";
import { Order } from "../../../../Shared/domain/criteria/Order.js";
import { Uuid } from "../../../../Shared/domain/value-object/Uuid.js";

const buildAlert = (id: string): Alert =>
  Alert.createFromKnownPattern({
    id: new AlertId(id),
    monitoringEvent: new MonitoringEvent({
      eventId: Uuid.random().value,
      eventName: "ec.payment.timeout",
      aggregateId: "payment-001",
      occurredOn: new Date("2026-01-01T00:00:00Z"),
      payload: { orderId: "order-001" },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.critical(),
      source: "payment",
    }),
    classification: {
      type: "known",
      source: ClassificationRuleKind.EXACT_MATCH,
      patternId: "pattern-001",
      patternName: "PAYMENT_TIMEOUT",
      severity: AlertSeverity.critical(),
      confidence: ClassificationConfidence.certain(),
      matchedConditions: [],
      unmatchedConditions: [],
    } satisfies KnownAlertClassification,
  });

// 呼び出しを記録する fake inner（Mongo 相当）。
class FakeInnerRepository implements AlertRepository {
  save = vi.fn(async (_a: Alert) => {});
  findById = vi.fn(async (_id: AlertId): Promise<Alert | null> => null);
  findByCriteria = vi.fn(async (_c: Criteria): Promise<Alert[]> => []);
  findOpenByDedupKey = vi.fn(async (_k: string): Promise<Alert | null> => null);
}

// in-memory な read-model store fake。
class FakeStore implements AlertReadModelStore {
  alerts = new Map<string, ReturnType<Alert["toPrimitives"]>>();
  list: ReturnType<Alert["toPrimitives"]>[] | null = null;
  getAlert = vi.fn(async (id: string) => this.alerts.get(id) ?? null);
  saveAlert = vi.fn(async (a: ReturnType<Alert["toPrimitives"]>) => {
    this.alerts.set(a.id, a);
  });
  getList = vi.fn(async () => this.list);
  saveList = vi.fn(async (l: ReturnType<Alert["toPrimitives"]>[]) => {
    this.list = l;
  });
  invalidateList = vi.fn(async () => {
    this.list = null;
  });
}

describe("ReadModelCachingAlertRepository", () => {
  let inner: FakeInnerRepository;
  let store: FakeStore;
  let repo: ReadModelCachingAlertRepository;

  beforeEach(() => {
    inner = new FakeInnerRepository();
    store = new FakeStore();
    repo = new ReadModelCachingAlertRepository(inner, store);
  });

  describe("findById（cache-aside）", () => {
    it("miss 時は Mongo を読み read-model に再投入する", async () => {
      const alert = buildAlert(new AlertId(Uuid.random().value).value);
      inner.findById.mockResolvedValueOnce(alert);

      const result = await repo.findById(alert.id);

      expect(result?.id.value).toBe(alert.id.value);
      expect(inner.findById).toHaveBeenCalledTimes(1);
      expect(store.saveAlert).toHaveBeenCalledTimes(1);
    });

    it("hit 時は Mongo を読まず read-model から返す", async () => {
      const alert = buildAlert(new AlertId(Uuid.random().value).value);
      store.alerts.set(alert.id.value, alert.toPrimitives());

      const result = await repo.findById(alert.id);

      expect(result?.id.value).toBe(alert.id.value);
      expect(inner.findById).not.toHaveBeenCalled();
    });
  });

  describe("findByCriteria", () => {
    it("フィルタ無し（一覧）: miss→Mongo＋一覧投入、hit→Mongo を読まない", async () => {
      const alert = buildAlert(new AlertId(Uuid.random().value).value);
      inner.findByCriteria.mockResolvedValueOnce([alert]);

      const first = await repo.findByCriteria(Criteria.none());
      expect(first.map((a) => a.id.value)).toEqual([alert.id.value]);
      expect(inner.findByCriteria).toHaveBeenCalledTimes(1);
      expect(store.saveList).toHaveBeenCalledTimes(1);

      const second = await repo.findByCriteria(Criteria.none());
      expect(second.map((a) => a.id.value)).toEqual([alert.id.value]);
      expect(inner.findByCriteria).toHaveBeenCalledTimes(1); // 増えない＝hit
    });

    it("フィルタ付きは常に Mongo 直読（read-model に触れない）", async () => {
      const filtered = new Criteria(
        new Filters([{} as unknown as Filter]),
        Order.none(),
      );
      await repo.findByCriteria(filtered);

      expect(inner.findByCriteria).toHaveBeenCalledTimes(1);
      expect(store.getList).not.toHaveBeenCalled();
    });
  });

  describe("save", () => {
    it("Mongo 保存後に per-id upsert ＋ 一覧 invalidate", async () => {
      const alert = buildAlert(new AlertId(Uuid.random().value).value);

      await repo.save(alert);

      expect(inner.save).toHaveBeenCalledWith(alert);
      expect(store.saveAlert).toHaveBeenCalledTimes(1);
      expect(store.invalidateList).toHaveBeenCalledTimes(1);
    });
  });

  it("findOpenByDedupKey は SoT 直読（passthrough）", async () => {
    await repo.findOpenByDedupKey("dedup-1");
    expect(inner.findOpenByDedupKey).toHaveBeenCalledWith("dedup-1");
  });

  it("read-model が落ちても Mongo 経路は壊れない（best-effort fallback）", async () => {
    const alert = buildAlert(new AlertId(Uuid.random().value).value);
    store.getAlert.mockRejectedValueOnce(new Error("valkey down"));
    inner.findById.mockResolvedValueOnce(alert);

    const result = await repo.findById(alert.id);

    expect(result?.id.value).toBe(alert.id.value);
    expect(inner.findById).toHaveBeenCalledTimes(1);
  });
});
