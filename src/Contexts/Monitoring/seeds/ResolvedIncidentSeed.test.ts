import { describe, it, expect } from "vitest";
import { RESOLVED_INCIDENT_SEEDS } from "./ResolvedIncidentSeed.js";
import { InMemorySimilarIncidentRepository } from "../SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.js";
import { SimilarPatternRule } from "../AlertAnalysis/domain/classification/rules/SimilarPatternRule.js";
import { MonitoringEvent } from "../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../Shared/domain/AlertSeverity.js";

/**
 * デモシナリオ2（類似・準既知）の成立条件を実部品で固定するテスト。
 *
 * 実トリガ（PaymentMode=DECLINED の実注文）が発火する ec.payment.declined イベントは、
 * translator（CollectMonitoringEventOnECEventPublished）が UUID の orderId/customerId と
 * 数値 amount を payload に載せる。それでも SimilarPatternRule のクエリ組み立てが
 * 発生毎ノイズを除外するため、reset seed の解決済み事例と Jaccard 5/7 ≈ 0.714 で
 * 「準・既知」（しきい値 0.6 以上・完全一致未満）に分類される。
 *
 * seed 語彙・translator payload・buildQueryText のどれかを変えるとこの数値が動く＝
 * デモ卓の「約71%類似」表示と UI donut の前提が壊れるので、ここで実測を固定する。
 */

// translator が実際に組み立てるのと同じ形の MonitoringEvent（UUID/数値ノイズ込み）。
function realisticDeclinedEvent(): MonitoringEvent {
  return new MonitoringEvent({
    eventId: crypto.randomUUID(),
    eventName: "ec.payment.declined",
    aggregateId: crypto.randomUUID(), // paymentAttemptId
    occurredOn: new Date(),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "payment",
    payload: {
      orderId: crypto.randomUUID(),
      customerId: crypto.randomUUID(),
      amount: 1000,
      reason: "PROVIDER_UNAVAILABLE",
    },
  });
}

describe("ResolvedIncidentSeed × SimilarPatternRule（シナリオ2の成立条件）", () => {
  async function classify() {
    const repository = new InMemorySimilarIncidentRepository();
    for (const incident of RESOLVED_INCIDENT_SEEDS) {
      await repository.index(incident);
    }
    return new SimilarPatternRule(repository).classify(realisticDeclinedEvent());
  }

  it("実イベント（UUID/数値ノイズ込み）が seed 事例に 5/7 ≈ 0.714 で準・既知分類される", async () => {
    const result = await classify();

    expect(result).not.toBeNull();
    expect(result?.type).toBe("known");
    // Jaccard 5/7。seed 語彙・payload 語彙を変えたら ResolvedIncidentSeed の計算コメントごと更新すること。
    expect(result?.confidence.value).toBeCloseTo(5 / 7, 5);
  });

  it("分類は完全一致(1.0)ではなく確度付き＝準・既知の帯（0.6〜1.0未満）", async () => {
    const result = await classify();

    expect(result?.confidence.value).toBeGreaterThanOrEqual(0.6);
    expect(result?.confidence.value).toBeLessThan(1);
  });

  it("back-link は seed のアーカイブ Alert（sourceAlertId）を指す", async () => {
    const result = await classify();

    expect(result?.sourceAlertId).toBe(RESOLVED_INCIDENT_SEEDS[0].sourceAlertId);
    expect(result?.resolvedNote).toBe(RESOLVED_INCIDENT_SEEDS[0].resolvedNote);
  });
});
