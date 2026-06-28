import { Request, Response } from "express";
import { Logger } from "../../../../../../Contexts/Shared/domain/logging/Logger.js";

/**
 * デモ用インフラ障害の注入。業務的失敗（在庫不足/決済タイムアウト＝ハンドリング済みで 4xx・WARN）
 * では発火しない「経路B（Cloud Monitoring）」を実環境で発火させるための専用注入点。
 *
 * EC backend は GCE backbone（worker）上で動くため、発報の主経路は CRITICAL ログ:
 *  - CRITICAL ログ → `ec_monitoring_critical_log` メトリクス（フィルタは gce_instance も対象）→ アラートポリシー
 *  → Cloud Monitoring が webhook で `/ingest/cloud-monitoring` に届ける。
 * HTTP 500 も併せて返すが、`cloud_run_5xx` ポリシーは Cloud Run（edge）専用なので EC の 500 は数えない。
 * 500 はローカルで「障害が起きた」ことを目視するためと、将来 edge 側で同種注入する際の整合のため。
 * （ローカルには Cloud Monitoring が無いため、ローカルでは「500とCRITICALログが出るだけ」で Alert は生成されない）
 */
export class InfraFaultPostController {
  constructor(private readonly logger: Logger) {}

  async run(_req: Request, res: Response): Promise<void> {
    await this.logger.critical({
      service: "ec-backend",
      action: "demo_infra_fault",
      message:
        "デモ用インフラ障害を注入：意図的に CRITICAL ログと HTTP 500 を発生させ、Cloud Monitoring 経由の自動発報（経路B）を確認する",
    });
    // errorHandler を介さず直接 500 を返す（cloud_run_5xx ポリシーは HTTP ステータスで数える）。
    res.status(500).json({
      type: "infrastructure",
      msg: "Injected demo infrastructure fault",
    });
  }
}
