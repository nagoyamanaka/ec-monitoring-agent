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

  it("documentation.content（発報の本文）を payload に取り込む", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(
      openIncident({
        documentation: {
          content: "対象サービス: ec-backend\n検知ログ: CRITICAL を記録",
          mime_type: "text/markdown",
        },
      }),
    );
    expect(event.payload["documentation"]).toBe(
      "対象サービス: ec-backend\n検知ログ: CRITICAL を記録",
    );
  });

  it("documentation 未設定（content 空文字）は無情報として null に畳む", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(
      openIncident({ documentation: { content: "", mime_type: "text/markdown" } }),
    );
    expect(event.payload["documentation"]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 実機 payload fixture（version 1.2）
// GCP が実際に送る完全構造ペイロードで正規化結果を検証する。
// 合成テストが拾えない extra フィールド（metadata / documentation / condition ネスト等）
// が defensive reading を壊さないことも確認する目的。
// ---------------------------------------------------------------------------

/**
 * terraform modules/monitoring/main.tf の cloud_run_5xx ポリシーが
 * 実際に発火したときに GCP が送る webhook payload (version 1.2)。
 * condition_name="5xx request rate" / metric.type=run.googleapis.com/request_count
 * → 飽和系ヒット無し → category=INFRASTRUCTURE
 */
const CLOUD_RUN_5XX_OPEN: unknown = {
  version: "1.2",
  incident: {
    incident_id: "0.abc123defgh",
    scoping_project_id: "my-gcp-project",
    scoping_project_number: 123456789,
    url: "https://console.cloud.google.com/monitoring/alerting/incidents/0.abc123defgh?project=my-gcp-project",
    started_at: 1_700_000_000,
    ended_at: null,
    state: "open",
    resource_id: "",
    resource_name: "my-gcp-project",
    resource_display_name: "my-gcp-project",
    resource_type_display_name: "Cloud Run Revision",
    resource: {
      type: "cloud_run_revision",
      labels: {
        configuration_name: "backoffice-edge",
        location: "asia-northeast1",
        project_id: "my-gcp-project",
        revision_name: "backoffice-edge-00001-abc",
        service_name: "backoffice-edge",
      },
    },
    metric: {
      type: "run.googleapis.com/request_count",
      displayName: "Request count",
      labels: { response_code_class: "5xx" },
    },
    metadata: { system_labels: {}, user_labels: {} },
    policy_name: "Cloud Run 5xx 増加 (backoffice-edge)",
    policy_user_labels: {},
    documentation: { content: "", mime_type: "text/markdown", links: [] },
    condition_name: "5xx request rate",
    threshold_value: "0.1",
    observed_value: "0.52",
    severity: "Warning",
    condition: {
      name: "projects/my-gcp-project/alertPolicies/111/conditions/222",
      displayName: "5xx request rate",
      conditionThreshold: {
        filter: 'resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count"',
        comparison: "COMPARISON_GT",
        thresholdValue: 0.1,
        duration: "60s",
        trigger: { count: 1 },
      },
    },
  },
};

const CLOUD_RUN_5XX_CLOSED: unknown = {
  version: "1.2",
  incident: {
    ...(CLOUD_RUN_5XX_OPEN as { incident: object }).incident,
    state: "closed",
    ended_at: 1_700_003_600,
  },
};

describe("実機 payload fixture (version 1.2) — cloud_run_5xx ポリシー", () => {
  it("open: category=INFRASTRUCTURE（飽和系ヒット無し）", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN);
    expect(event.category.value).toBe("INFRASTRUCTURE");
  });

  it("open: eventName は condition_name から導出", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN);
    expect(event.eventName).toBe("gcp.monitoring.5xx_request_rate");
  });

  it("open: severity=Warning → WARNING にマップ", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN);
    expect(event.severity.value).toBe("WARNING");
    expect(event.isAlertable()).toBe(true);
  });

  it("open: dedupKey は source::category::eventName の形式", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN);
    expect(event.dedupKey()).toBe(
      "cloud-monitoring::INFRASTRUCTURE::gcp.monitoring.5xx_request_rate",
    );
  });

  it("open: aggregateId は incident_id を優先採用", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN);
    expect(event.aggregateId).toBe("0.abc123defgh");
  });

  it("open: payload に incidentId / policyName / resourceType が格納される", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN);
    expect(event.payload).toMatchObject({
      incidentId: "0.abc123defgh",
      policyName: "Cloud Run 5xx 増加 (backoffice-edge)",
      conditionName: "5xx request rate",
      state: "open",
      resourceType: "cloud_run_revision",
      metricType: "run.googleapis.com/request_count",
    });
  });

  it("closed: severity → INFO で isAlertable=false（回復通知は分類/調査に乗らない）", () => {
    const event = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_CLOSED);
    expect(event.severity.value).toBe("INFO");
    expect(event.isAlertable()).toBe(false);
  });

  it("closed: dedupKey は open と同一（同一インシデントとして重複排除できる）", () => {
    const open = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN);
    const closed = CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_CLOSED);
    expect(open.dedupKey()).toBe(closed.dedupKey());
  });

  it("version/metadata/documentation 等の extra フィールドがあっても例外を投げない", () => {
    expect(() =>
      CloudMonitoringAlertTranslator.toMonitoringEvent(CLOUD_RUN_5XX_OPEN),
    ).not.toThrow();
  });
});
