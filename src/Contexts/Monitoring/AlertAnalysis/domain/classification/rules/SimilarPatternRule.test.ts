import { describe, it, expect } from "vitest";
import { SimilarPatternRule } from "./SimilarPatternRule.js";
import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../../../Shared/domain/AlertSeverity.js";
import { ClassificationRuleKind } from "../ClassificationRuleKind.js";
import { Criteria } from "../../../../../Shared/domain/criteria/Criteria.js";
import {
  ResolvedIncident,
  ScoredIncident,
  SimilarIncidentRepository,
  SimilarSearchQuery,
} from "../../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { SimilarIncident } from "../../../../SimilarIncident/domain/SimilarIncident.js";

// search のみ使う Rule の UT 用フェイク（findSimilar / index は未使用）。
class FakeSearchPort implements SimilarIncidentRepository {
  public lastQuery: SimilarSearchQuery | null = null;
  constructor(private readonly results: ScoredIncident[]) {}
  async search(query: SimilarSearchQuery): Promise<ScoredIncident[]> {
    this.lastQuery = query;
    return this.results;
  }
  async findSimilar(_criteria: Criteria): Promise<SimilarIncident[]> {
    return [];
  }
  async index(_incident: ResolvedIncident): Promise<void> {}
}

function makeIncident(params: {
  id?: string;
  eventName?: string;
  resolvedNote?: string;
  severity?: AlertSeverity;
  sourceAlertId?: string;
}): SimilarIncident {
  return {
    id: params.id ?? "inc-001",
    eventName: params.eventName ?? "ec.inventory.reservation_failed",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    resolvedNote: params.resolvedNote ?? "在庫枯渇により失敗",
    resolvedAt: new Date("2026-01-02T00:00:00.000Z"),
    severity: params.severity ?? AlertSeverity.warning(),
    ...(params.sourceAlertId !== undefined
      ? { sourceAlertId: params.sourceAlertId }
      : {}),
  };
}

function makeEvent(params?: {
  eventName?: string;
  payload?: Record<string, unknown>;
}): MonitoringEvent {
  return new MonitoringEvent({
    eventId: "evt-001",
    eventName: params?.eventName ?? "ec.inventory.reservation_failed",
    aggregateId: "agg-001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: params?.payload ?? {},
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "test",
  });
}

describe("SimilarPatternRule", () => {
  it("kind は SIMILARITY", () => {
    const rule = new SimilarPatternRule(new FakeSearchPort([]));
    expect(rule.kind).toBe(ClassificationRuleKind.SIMILARITY);
  });

  it("ヒット無しなら null（棄権）", async () => {
    const rule = new SimilarPatternRule(new FakeSearchPort([]));
    expect(await rule.classify(makeEvent())).toBeNull();
  });

  it("閾値以上の類似度なら graded confidence の known 分類を返す", async () => {
    const rule = new SimilarPatternRule(
      new FakeSearchPort([{ incident: makeIncident({}), score: 0.82 }]),
    );

    const result = await rule.classify(makeEvent());

    expect(result).not.toBeNull();
    expect(result?.type).toBe("known");
    expect(result?.confidence.value).toBeCloseTo(0.82);
    // 完全一致(1.0)ではない＝連続スペクトルの確度
    expect(result?.confidence.isHighConfidence()).toBe(true);
    expect(result?.patternId).toBe("similar:inc-001");
    expect(result?.unmatchedConditions).toHaveLength(0);
  });

  it("閾値未満の類似度は null（棄権して下位 Rule に委ねる）", async () => {
    const rule = new SimilarPatternRule(
      new FakeSearchPort([{ incident: makeIncident({}), score: 0.4 }]),
      0.6,
    );
    expect(await rule.classify(makeEvent())).toBeNull();
  });

  it("複数ヒットのうち最も類似度の高いものを採用する（降順非保証でも）", async () => {
    const rule = new SimilarPatternRule(
      new FakeSearchPort([
        { incident: makeIncident({ id: "low" }), score: 0.62 },
        { incident: makeIncident({ id: "high" }), score: 0.9 },
      ]),
    );

    const result = await rule.classify(makeEvent());

    expect(result?.patternId).toBe("similar:high");
    expect(result?.confidence.value).toBeCloseTo(0.9);
  });

  it("scoreCeiling で生スコアを [0,1] に正規化する", async () => {
    // BM25 風の生スコア 12 を ceiling 20 で正規化 → 0.6
    const rule = new SimilarPatternRule(
      new FakeSearchPort([{ incident: makeIncident({}), score: 12 }]),
      0.6,
      20,
    );

    const result = await rule.classify(makeEvent());

    expect(result?.confidence.value).toBeCloseTo(0.6);
  });

  it("ceiling を超える生スコアは 1.0 にクランプされる", async () => {
    const rule = new SimilarPatternRule(
      new FakeSearchPort([{ incident: makeIncident({}), score: 50 }]),
      0.6,
      20,
    );

    const result = await rule.classify(makeEvent());

    expect(result?.confidence.value).toBe(1);
  });

  it("severity はマッチしたインシデントの severity を引き継ぐ", async () => {
    const rule = new SimilarPatternRule(
      new FakeSearchPort([
        { incident: makeIncident({ severity: AlertSeverity.critical() }), score: 0.9 },
      ]),
    );

    const result = await rule.classify(makeEvent());

    expect(result?.severity.isCritical()).toBe(true);
  });

  it("マッチしたインシデントの sourceAlertId を back-link として分類結果へ載せる", async () => {
    const rule = new SimilarPatternRule(
      new FakeSearchPort([
        { incident: makeIncident({ sourceAlertId: "alert-past-1" }), score: 0.9 },
      ]),
    );

    const result = await rule.classify(makeEvent());

    expect(result?.sourceAlertId).toBe("alert-past-1");
  });

  it("sourceAlertId 未保持のインシデントは back-link を載せない", async () => {
    const rule = new SimilarPatternRule(
      new FakeSearchPort([{ incident: makeIncident({}), score: 0.9 }]),
    );

    const result = await rule.classify(makeEvent());

    expect(result?.sourceAlertId).toBeUndefined();
  });

  it("クエリは eventName と payload から組み立てる", async () => {
    const port = new FakeSearchPort([]);
    const rule = new SimilarPatternRule(port);

    await rule.classify(
      makeEvent({
        eventName: "ec.payment.timeout",
        payload: { orderId: "o-1", amount: 5000 },
      }),
    );

    expect(port.lastQuery?.eventName).toBe("ec.payment.timeout");
    expect(port.lastQuery?.text).toContain("ec.payment.timeout");
    expect(port.lastQuery?.text).toContain("orderId=o-1");
    expect(port.lastQuery?.text).toContain("amount=5000");
  });
});
