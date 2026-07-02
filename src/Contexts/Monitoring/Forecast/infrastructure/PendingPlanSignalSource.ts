import { Logger } from "../../../Shared/domain/logging/Logger.js";
import { TerraformGateway } from "../../AIInvestigation/infrastructure/infrainvestigation/TerraformGateway.js";
import { ForecastSignal, ForecastSignalKind } from "../domain/ForecastSignal.js";
import { ForecastSignalSource } from "../domain/ForecastSignalSource.js";
import { normalizeSubject } from "../domain/forecastSubject.js";

// terraform 未適用 plan（＝FUTURE_CHANGE）を ForecastSignal に正規化する。
// subject は先頭リソースアドレス由来＝ForecastMemory 側の terraform 優先導出（forecastSubject）と
// 同じ語彙になり、インフラ起因の記憶とそのまま突合できる。
export class PendingPlanSignalSource implements ForecastSignalSource {
  constructor(
    private readonly terraformGateway: TerraformGateway,
    private readonly logger: Logger,
  ) {}

  async collect(_horizon: string): Promise<ForecastSignal[]> {
    try {
      const plans = await this.terraformGateway.getPendingPlan();
      return plans.map((plan, index) => ({
        id: `plan-${index + 1}`,
        kind: ForecastSignalKind.FUTURE_CHANGE,
        subject: normalizeSubject(
          plan.resourceChanges[0]?.address ?? plan.summary,
        ),
        when: "plan済み・未適用（apply され次第有効）",
        desc: plan.summary,
        source: "terraform.plan",
        ...(plan.url ? { url: plan.url } : {}),
      }));
    } catch (error) {
      // 予兆はベストエフォート＝1源の失敗で予報全体を落とさない（他シグナルで縮退継続）。
      await this.logger.warn({
        service: "backoffice-backend",
        action: "forecast_signal_collect_failed",
        message: `pending plan シグナル収集に失敗しました（スキップ）：${(error as Error).message}`,
      });
      return [];
    }
  }
}
