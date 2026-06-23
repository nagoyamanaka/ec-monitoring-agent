import { NextFunction, Request, Response } from "express";
import { CollectMonitoringEventUseCase } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { AlertSeverity } from "../../../../../../Contexts/Monitoring/Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../../../../Contexts/Monitoring/Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../../../Contexts/Monitoring/Shared/domain/MonitoringEventCategory.js";

/** スキャン1回で出た脆弱性1件分（CI 側で Trivy/npm audit の生形式から正規化済み）。 */
type ScanVulnerability = {
  cveId?: string;
  severity?: string;
  package?: string;
  version?: string;
  fixedVersion?: string;
};

/**
 * CI から届く security-scan の正規化済みボディ。
 * Trivy は1スキャンで HIGH/CRITICAL を「どばっと」吐くため、CI 側（jq）で
 *   - HIGH/CRITICAL のみ抽出
 *   - 最深刻（CRITICAL 優先）を代表 CVE としてトップレベルに昇格
 *   - 全件を `vulnerabilities[]` に同梱（AI 一括リメディ/PR 起票が一覧を参照するため）
 * まで整形してから1リクエストで送る。境界（このコントローラ）は薄く保つ。
 */
type SecurityScanBody = {
  // 代表（最深刻）CVE — インシデントのアンカー
  cveId?: string;
  severity?: string;
  package?: string;
  version?: string;
  fixedVersion?: string;
  repo?: string;
  scanner?: string; // "trivy" | "npm_audit"。dedup/source の弁別子
  target?: string; // スキャン対象（"repo:fs" / イメージ参照 等）
  // スキャン1回で出た HIGH/CRITICAL 全件。リメディエーション（PR起票）はここを使う。
  vulnerabilities?: ScanVulnerability[];
};

const ALERTABLE_SEVERITIES = new Set(["HIGH", "CRITICAL"]);

/**
 * POST /ingest/security-scan
 * CI（GitHub Actions の Trivy/npm audit）からのスキャン結果を受け、
 * ECDomainEvent を経由せず直接 MonitoringEvent(category=SECURITY) を構築して調査パイプラインへ流す。
 *
 * Trivy の生出力（Results[].Vulnerabilities[] のネスト・大量）は CI 側で代表CVE+全件配列に
 * 正規化済みである前提。代表CVEの severity が HIGH/CRITICAL 未満なら 204 で黙って無視。
 * 全 CVE は payload.vulnerabilities に載せ、後段の AI 調査/PR 起票が一括で参照する。
 * dedupKey は source(scanner)×category×eventName 粒度なので、CI 再実行や複数 CVE は
 * 1インシデント（×occurrenceCount）に畳まれる。
 */
export class SecurityScanIngestPostController {
  constructor(
    private readonly collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
    private readonly ingestToken: string,
  ) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (this.ingestToken && req.header("x-ingest-token") !== this.ingestToken) {
        res.status(401).json({ error: "invalid ingest token" });
        return;
      }

      const body = req.body as SecurityScanBody;
      const incomingSeverity = (body.severity ?? "").toUpperCase();

      if (!ALERTABLE_SEVERITIES.has(incomingSeverity)) {
        res.status(204).end();
        return;
      }

      const vulnerabilities = Array.isArray(body.vulnerabilities) ? body.vulnerabilities : [];
      const cveId = body.cveId ?? "unknown";
      const scanner = body.scanner ?? "trivy";
      const monitoringEvent = new MonitoringEvent({
        eventId: crypto.randomUUID(),
        eventName: "security.vulnerability_detected",
        aggregateId: cveId,
        occurredOn: new Date(),
        category: MonitoringEventCategory.security(),
        severity: incomingSeverity === "CRITICAL" ? AlertSeverity.critical() : AlertSeverity.warning(),
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

      await this.collectMonitoringEventUseCase.run(monitoringEvent);
      res.status(202).json({ accepted: true, vulnerabilityCount: vulnerabilities.length });
    } catch (error) {
      next(error);
    }
  }
}
