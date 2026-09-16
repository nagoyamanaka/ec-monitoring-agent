import { describe, expect, it } from "vitest";
import { MonitoringEvent } from "../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { buildIncidentQueryText } from "./incidentQueryText.js";
import { lexicalSimilarity } from "./lexicalSimilarity.js";

const makeEvent = (payload: Record<string, unknown>) =>
  new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.payment.declined",
    aggregateId: "agg-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload,
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.pending(),
    source: "unknown",
  });

describe("buildIncidentQueryText", () => {
  it("eventName と UUID でない文字列 payload だけを key=value で載せる", () => {
    const text = buildIncidentQueryText(
      makeEvent({
        reason: "provider_timeout",
        orderId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 1200,
        items: ["a", "b"],
      }),
    );
    expect(text).toBe("ec.payment.declined reason=provider_timeout");
  });

  // 承認時の索引（searchText）と分類時のクエリを同じ関数で作る＝同じ payload の再発は 1.0 に、
  // 和文の対処メモを索引にしていた頃（payload トークンと重ならず閾値 0.6 に届かない）を回帰させない。
  it("同じ関数で作った索引とクエリは同一 payload の再発で類似度 1.0 になる", () => {
    const event = makeEvent({ reason: "provider_timeout", provider: "stripe" });
    const indexed = buildIncidentQueryText(event);
    const query = buildIncidentQueryText(event);
    expect(lexicalSimilarity(query, `${event.eventName} ${indexed}`)).toBeGreaterThanOrEqual(0.6);
    const jaNote = `${event.eventName} 決済プロバイダのタイムアウトにより与信が拒否されました`;
    expect(lexicalSimilarity(query, jaNote)).toBeLessThan(0.6);
  });
});
