import { describe, it, expect } from "vitest";
import {
  detectionDetailFromPayload,
  documentationRows,
  isCloudMonitoringAutoSummary,
  parseResourceName,
} from "./DetectionDetailView";

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

describe("isCloudMonitoringAutoSummary", () => {
  it("CM 自動生成の英文（Log match condition … fired for …）を機械文と判定する", () => {
    expect(
      isCloudMonitoringAutoSummary(
        "Log match condition with labels {action=demo_infra_fault,log_message=デモ用インフラ障害を注入：意図的に CRITICAL ログと HTTP 500 を発生させ、Cloud Monitoring 経由の自動発報（経路B）を確認する,service=ec-backend} fired for VM Instance with {instance_id=971418685088913937, project_id=ec-monitoring-agent-501600, zone=asia-northeast1-a}.",
      ),
    ).toBe(true);
  });

  it("人間語の日本語 summary（合成 3b 等）は機械文と判定しない", () => {
    expect(
      isCloudMonitoringAutoSummary(
        "GCE backbone (ec-monitoring-backbone) 上の ec-backend が severity=CRITICAL のログを記録（HTTP 500 併発）【デモ合成注入・実発報と同型 webhook】",
      ),
    ).toBe(false);
  });
});

describe("documentationRows", () => {
  it("「ラベル: 値」の行構成を定義リスト用の行へパースする（値中の全角コロンは保持）", () => {
    const rows = documentationRows(
      [
        "対象サービス: ec-backend（action: demo_infra_fault）",
        "検知ログ: デモ用インフラ障害を注入：意図的に CRITICAL ログと HTTP 500 を発生させる",
        "発火条件: Cloud Run（edge）/ GCE backbone（worker）の severity>=CRITICAL ログ",
      ].join("\n"),
    );
    expect(rows).toEqual([
      { label: "対象サービス", value: "ec-backend（action: demo_infra_fault）" },
      {
        label: "検知ログ",
        value:
          "デモ用インフラ障害を注入：意図的に CRITICAL ログと HTTP 500 を発生させる",
      },
      {
        label: "発火条件",
        value: "Cloud Run（edge）/ GCE backbone（worker）の severity>=CRITICAL ログ",
      },
    ]);
  });

  it("行構成でない自由文は null（呼び出し側が生テキスト表示へフォールバック）", () => {
    expect(
      documentationRows("このポリシーは CRITICAL ログを監視します。詳細は runbook 参照。"),
    ).toBeNull();
  });

  it("空行だけ・空文字は null", () => {
    expect(documentationRows("\n  \n")).toBeNull();
  });
});

describe("parseResourceName", () => {
  it("「Type labels {k=v,…}」形の実発報 resource_name を種別＋ラベルへ分解する", () => {
    const parsed = parseResourceName(
      "VM Instance labels {instance_id=971418685088913937, project_id=ec-monitoring-agent-501600, zone=asia-northeast1-a}",
    );
    expect(parsed).toEqual({
      descriptor: "VM Instance",
      labels: [
        { key: "instance_id", value: "971418685088913937" },
        { key: "project_id", value: "ec-monitoring-agent-501600" },
        { key: "zone", value: "asia-northeast1-a" },
      ],
    });
  });

  it("素の名前（合成 3b の ec-monitoring-backbone 等）は null＝そのまま表示", () => {
    expect(parseResourceName("ec-monitoring-backbone")).toBeNull();
  });

  it("値に , を含むラベルは直前の値へ結合して守る", () => {
    const parsed = parseResourceName(
      "VM Instance labels {note=a,b, zone=asia-northeast1-a}",
    );
    expect(parsed?.labels).toEqual([
      { key: "note", value: "a,b" },
      { key: "zone", value: "asia-northeast1-a" },
    ]);
  });
});
