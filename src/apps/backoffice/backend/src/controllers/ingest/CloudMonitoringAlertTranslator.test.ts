import { describe, it, expect } from "vitest";
import { CloudMonitoringAlertTranslator } from "./CloudMonitoringAlertTranslator.js";

const openIncident = (overrides: Record<string, unknown> = {}) => ({
  incident: {
    incident_id: "inc-1",
    resource_name: "cloudsql:prod-db",
    policy_name: "DB CPU high",
    condition_name: "Cloud SQL CPU utilization",
    state: "open",
    started_at: 1_700_000_000,
    summary: "CPU > 90%",
    severity: "Critical",
    resource: { type: "cloudsql_database" },
    metric: { type: "cloudsql.googleapis.com/database/cpu/utilization" },
    ...overrides,
  },
});

describe("CloudMonitoringAlertTranslator", () => {
  it("source は cloud-monitoring に固定される", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(openIncident());
    expect(event.source).toBe("cloud-monitoring");
  });

  it("eventName は condition_name をスラグ化して導出する（dedup の粒度になる）", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(openIncident());
    expect(event.eventName).toBe("gcp.monitoring.cloud_sql_cpu_utilization");
  });

  it("同じ condition の2発火は同一 dedupKey になる（incident_id に依存しない）", () => {
    const a = CloudMonitoringAlertTranslator.toMonitoringEvent(openIncident({ incident_id: "inc-A" }));
    const b = CloudMonitoringAlertTranslator.toMonitoringEvent(openIncident({ incident_id: "inc-B" }));
    expect(a.dedupKey()).toBe(b.dedupKey());
  });

  it("CPU/接続数などの飽和系は CAPACITY に分類される", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(openIncident());
    expect(event.category.value).toBe("CAPACITY");
  });

  it("飽和系でないインフラ事象は INFRASTRUCTURE に分類される", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(
      openIncident({
        condition_name: "TLS cert expiring",
        metric: { type: "monitoring/uptime_check/cert" },
        resource: { type: "uptime_url" },
      }),
    );
    expect(event.category.value).toBe("INFRASTRUCTURE");
  });

  it("severity=Critical は CRITICAL にマップされる", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(openIncident());
    expect(event.severity.value).toBe("CRITICAL");
  });

  it("severity 欠落時は安全側で WARNING を既定にする", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(
      openIncident({ severity: undefined }),
    );
    expect(event.severity.value).toBe("WARNING");
  });

  it("closed 通知は info（観測のみ・アラート非対象）にする", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(
      openIncident({ state: "closed" }),
    );
    expect(event.severity.value).toBe("INFO");
    expect(event.isAlertable()).toBe(false);
  });

  it("空ペイロードでも例外を投げず unknown にフォールバックする", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent({});
    expect(event.eventName).toBe("gcp.monitoring.unknown");
    expect(event.aggregateId).toBe("unknown");
  });
});
