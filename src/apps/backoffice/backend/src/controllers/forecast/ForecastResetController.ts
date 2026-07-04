import { NextFunction, Request, Response } from "express";
import { RiskForecastRepository } from "../../../../../../Contexts/Monitoring/Forecast/domain/ForecastBriefing.js";

// 生成済み予報を破棄して未生成状態に戻す（デモ卓の「予報をリセット」・F12）。
// demoGuard 配下＝デモ環境のみ。アラート側の /demo/reset には**あえて相乗りしない**:
// 審査員がアラート一覧のリセットを押しただけで、提出前に温めた予報キャッシュ
// （無人閲覧の要）まで消えると GET /forecast が 404 になり一次審査で不利になるため。
export class ForecastResetController {
  constructor(private readonly riskForecastRepository: RiskForecastRepository) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.riskForecastRepository.clearLatest();
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  }
}
