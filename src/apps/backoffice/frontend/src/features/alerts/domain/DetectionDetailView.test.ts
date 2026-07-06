import { describe, it, expect } from "vitest";
import { detectionDetailFromPayload } from "./DetectionDetailView";

const cloudMonitoringPayload = {
  incidentId: "inc-1",
  policyName: "アプリ CRITICAL ログ検知",
  conditionName: "CRITICAL log entries",
  state: "open",
  summary: "ec-backend が severity=CRITICAL のログを記録",
  url: "https://console.cloud.google.com/monitoring/alerting/incidents/0.abc?project=p",
  resourceType: "gce_instance",
  resourceName: "ec-monitoring-backbone",
  metricType: null,
  documentation: "対象サービス: ec-backend（action: demo_infra_fault）\n検知ログ: デモ用インフラ障害を注入",
};

describe("detectionDetailFromPayload", () => {
  it("Cloud Monitoring payload から発報の生情報を射影する", () => {
    const detail = detectionDetailFromPayload(cloudMonitoringPayload);
    expect(detail).toEqual({
      summary: "ec-backend が severity=CRITICAL のログを記録",
      documentation:
        "対象サービス: ec-backend（action: demo_infra_fault）\n検知ログ: デモ用インフラ障害を注入",
      policyName: "アプリ CRITICAL ログ検知",
      resourceName: "ec-monitoring-backbone",
      resourceType: "gce_instance",
      metricType: null,
      incidentUrl:
        "https://console.cloud.google.com/monitoring/alerting/incidents/0.abc?project=p",
    });
  });

  it("該当フィールドを1つも持たない payload（EC 業務イベント等）は null", () => {
    expect(
      detectionDetailFromPayload({ orderId: "o-1", amount: 1200 }),
    ).toBeNull();
  });

  it("空文字・空白のみのフィールドは無情報として null に畳む", () => {
    const detail = detectionDetailFromPayload({
      summary: "  ",
      policyName: "",
      resourceName: "vm-1",
    });
    expect(detail).not.toBeNull();
    expect(detail?.summary).toBeNull();
    expect(detail?.policyName).toBeNull();
    expect(detail?.resourceName).toBe("vm-1");
  });

  it("https 以外の url はリンクにしない（外部入力を href に流す防御）", () => {
    const detail = detectionDetailFromPayload({
      summary: "x",
      // eslint-disable-next-line no-script-url
      url: "javascript:alert(1)",
    });
    expect(detail?.incidentUrl).toBeNull();
  });

  it("文字列以外の型のフィールドは捨てる（防御的パース）", () => {
    const detail = detectionDetailFromPayload({
      summary: 42,
      resourceName: ["a"],
      policyName: "p",
    });
    expect(detail?.summary).toBeNull();
    expect(detail?.resourceName).toBeNull();
    expect(detail?.policyName).toBe("p");
  });
});
