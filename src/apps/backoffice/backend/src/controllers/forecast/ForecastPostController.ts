import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { ForecastRiskCommand } from "../../../../../../Contexts/Monitoring/Forecast/application/ForecastRisk/ForecastRiskCommand.js";
import {
  RiskForecastRepository,
  toForecastBriefingPrimitives,
} from "../../../../../../Contexts/Monitoring/Forecast/domain/ForecastBriefing.js";

// 予報の生成（Gemini 課金あり）。horizon は config 固定＝無認証デモ経路に入力面を作らない。
// 生成結果（引用検証済み・fallback 含む）をそのまま返す＝デモ卓が結果を即confirm できる。
export class ForecastPostController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly riskForecastRepository: RiskForecastRepository,
    private readonly horizon: string,
  ) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.commandBus.dispatch(new ForecastRiskCommand(this.horizon));
      const latest = await this.riskForecastRepository.findLatest();
      if (!latest) {
        // Handler は必ず保存する（空予報/fallback 含む）ため通常到達しない防御分岐。
        res.status(500).json({ error: "予報の生成結果を取得できませんでした" });
        return;
      }
      res.status(200).json(toForecastBriefingPrimitives(latest));
    } catch (error) {
      next(error);
    }
  }
}
