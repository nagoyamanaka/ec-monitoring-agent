import { NextFunction, Request, Response } from "express";
import {
  RiskForecastRepository,
  toForecastBriefingPrimitives,
} from "../../../../../../Contexts/Monitoring/Forecast/domain/ForecastBriefing.js";

// 事前生成済みの最新予報を返す（Gemini 非呼び出し・課金ゼロ）＝審査員の非同期閲覧に耐える。
// 提出前に POST /forecast を1回打ってキャッシュを温めておく運用（step6 F6）。
export class ForecastGetController {
  constructor(private readonly riskForecastRepository: RiskForecastRepository) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const latest = await this.riskForecastRepository.findLatest();
      if (!latest) {
        res.status(404).json({ error: "予報はまだ生成されていません" });
        return;
      }
      res.json(toForecastBriefingPrimitives(latest));
    } catch (error) {
      next(error);
    }
  }
}
