import { AlertSeverity } from "../../../../../../Contexts/Monitoring/Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../../../../Contexts/Monitoring/Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../../../Contexts/Monitoring/Shared/domain/MonitoringEventCategory.js";

/**
 * Cloud Monitoring の Webhook 通知（Alerting Policy 発火）の最小サブセット。
 * 全フィールド optional ＝外部 JSON を信用せず防御的に読む。源固有の型はここだけが触れる。
 * 参照: Cloud Monitoring notification の incident ペイロード（version 1.2 系）。
 */
type CloudMonitoringWebhookPayload = {
  readonly incident?: {
    readonly incident_id?: string;
    readonly resource_name?: string;
    readonly resource_id?: string;
    readonly policy_name?: string;
    readonly condition_name?: string;
    readonly state?: string; // "open" | "closed"
    readonly started_at?: number; // epoch 秒
    readonly summary?: string;
    readonly url?: string;
    readonly severity?: string; // "Critical" | "Warning" 等（新しめのペイロードのみ）
    readonly resource?: { readonly type?: string; readonly labels?: Record<string, unknown> };
    readonly metric?: { readonly type?: string; readonly displayName?: string };
  };
};

// CAPACITY（飽和・容量）とみなすキーワード。該当しなければ INFRASTRUCTURE。
const CAPACITY_HINTS = [
  "cpu",
  "memory",
  "mem",
  "disk",
  "quota",
  "utilization",
  "saturation",
  "connection",
  "pool",
  "throughput",
  "latency",
  "backlog",
];

/**
 * Cloud Monitoring の発火アラートを観測フレームの共通語 MonitoringEvent へ正規化する ingest 境界。
 * EC の CollectMonitoringEventOnECEventPublished と対になる「検知ソース別の peer アダプタ」。
 *
 * 役割分担（検知の被り対策・category オーナーシップ）:
 *  - APPLICATION（業務失敗）は EC 自前 DomainEvent が権威。
 *  - INFRASTRUCTURE / CAPACITY（CPU/接続数/5xx 等の症状）は Cloud Monitoring が権威。
 *  ＝同じものを両ソースに監視させない設計で被りの大半を構造的に消す。
 */
export class CloudMonitoringAlertTranslator {
  static toMonitoringEvent(raw: unknown): MonitoringEvent {
    const incident = (raw as CloudMonitoringWebhookPayload)?.incident ?? {};

    const conditionLabel =
      incident.condition_name ?? incident.policy_name ?? "unknown";
    const eventName = `gcp.monitoring.${slugify(conditionLabel)}`;

    const isClosed = (incident.state ?? "").toLowerCase() === "closed";

    return new MonitoringEvent({
      eventId: crypto.randomUUID(),
      eventName,
      aggregateId:
        incident.incident_id ?? incident.resource_name ?? incident.resource_id ?? "unknown",
      occurredOn: parseEpochSeconds(incident.started_at),
      category: classifyCategory(
        `${conditionLabel} ${incident.metric?.type ?? ""} ${incident.resource?.type ?? ""}`,
      ),
      // closed 通知は「回復した」観測＝info（isAlertable=false で分類/調査に乗らず観測のみ）。
      // open はペイロード severity を尊重し、無ければ warning を既定にする。
      severity: isClosed ? AlertSeverity.info() : mapSeverity(incident.severity),
      source: "cloud-monitoring",
      payload: {
        incidentId: incident.incident_id ?? null,
        policyName: incident.policy_name ?? null,
        conditionName: incident.condition_name ?? null,
        state: incident.state ?? null,
        summary: incident.summary ?? null,
        url: incident.url ?? null,
        resourceType: incident.resource?.type ?? null,
        resourceName: incident.resource_name ?? null,
        metricType: incident.metric?.type ?? null,
      },
    });
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function classifyCategory(haystack: string): MonitoringEventCategory {
  const lower = haystack.toLowerCase();
  return CAPACITY_HINTS.some((hint) => lower.includes(hint))
    ? MonitoringEventCategory.capacity()
    : MonitoringEventCategory.infrastructure();
}

function mapSeverity(severity: string | undefined): AlertSeverity {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
      return AlertSeverity.critical();
    case "warning":
      return AlertSeverity.warning();
    default:
      // Cloud Monitoring が severity を載せないケースの安全側既定。
      return AlertSeverity.warning();
  }
}

function parseEpochSeconds(seconds: number | undefined): Date {
  if (typeof seconds === "number" && Number.isFinite(seconds)) {
    return new Date(seconds * 1000);
  }
  return new Date();
}
