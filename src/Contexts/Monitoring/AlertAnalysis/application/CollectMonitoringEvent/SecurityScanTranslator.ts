import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";

/** スキャン1回で出た脆弱性1件分（CI 側で Trivy/npm audit の生形式から正規化済み）。 */
export type ScanVulnerability = {
  readonly cveId?: string;
  readonly severity?: string;
  readonly package?: string;
  readonly version?: string;
  readonly fixedVersion?: string;
};

/**
 * CI から届く security-scan の正規化済みボディ。
 * Trivy は1スキャンで HIGH/CRITICAL を「どばっと」吐くため、CI 側（jq）で
 *   - HIGH/CRITICAL のみ抽出
 *   - 最深刻（CRITICAL 優先）を代表 CVE としてトップレベルに昇格
 *   - 全件を `vulnerabilities[]` に同梱（AI 一括リメディ/PR 起票が一覧を参照するため）
 * まで整形してから1リクエストで送る。源固有の型を知るのはこの Translator だけ。
 */
export type SecurityScanBody = {
  // 代表（最深刻）CVE — インシデントのアンカー
  readonly cveId?: string;
  readonly severity?: string;
  readonly package?: string;
  readonly version?: string;
  readonly fixedVersion?: string;
  readonly repo?: string;
  readonly scanner?: string; // "trivy" | "npm_audit"。dedup/source の弁別子
  readonly target?: string; // スキャン対象（"repo:fs" / イメージ参照 等）
  // スキャン1回で出た HIGH/CRITICAL 全件。リメディエーション（PR起票）はここを使う。
  readonly vulnerabilities?: ScanVulnerability[];
};

/**
 * CI（GitHub Actions の Trivy/npm audit）のスキャン結果を観測フレームの共通語 MonitoringEvent
 * へ正規化する ingest 境界。EC の CollectMonitoringEventOnECEventPublished / Cloud Monitoring の
 * CloudMonitoringAlertTranslator と並ぶ「検知ソース別の peer アダプタ」（同一ディレクトリに集約）。
 *
 * category オーナーシップ: SECURITY は CI（Trivy/npm audit）が権威。
 * severity は CRITICAL→critical / HIGH→warning / それ以外→info にマップし、
 * 「アラート対象か」は下流の isAlertable()（= !info）に委ねる
 * ＝Cloud Monitoring の closed→info と同じ「severity で alertable を表現する」作法に揃える。
 */
export class SecurityScanTranslator {
  static toMonitoringEvent(body: SecurityScanBody): MonitoringEvent {
    const vulnerabilities = Array.isArray(body.vulnerabilities)
      ? body.vulnerabilities
      : [];
    const cveId = body.cveId ?? "unknown";
    const scanner = body.scanner ?? "trivy";

    return new MonitoringEvent({
      eventId: crypto.randomUUID(),
      eventName: "security.vulnerability_detected",
      aggregateId: cveId,
      occurredOn: new Date(),
      category: MonitoringEventCategory.security(),
      severity: mapSeverity(body.severity),
      source: scanner,
      payload: {
        cveId,
        severity: body.severity ?? null,
        package: body.package ?? null,
        version: body.version ?? null,
        fixedVersion: body.fixedVersion ?? null,
        repo: body.repo ?? null,
        scanner,
        target: body.target ?? null,
        vulnerabilityCount: vulnerabilities.length,
        vulnerabilities,
      },
    });
  }
}

function mapSeverity(severity: string | undefined): AlertSeverity {
  switch ((severity ?? "").toUpperCase()) {
    case "CRITICAL":
      return AlertSeverity.critical();
    case "HIGH":
      return AlertSeverity.warning();
    default:
      // MEDIUM/LOW/UNKNOWN は観測のみ（isAlertable=false で分類/調査に乗せない）。
      return AlertSeverity.info();
  }
}
