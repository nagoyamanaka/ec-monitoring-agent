import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetAnalyticsQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/GetAnalyticsQuery.js";
import { AnalyticsResponse } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/AnalyticsResponse.js";
import { GetKnownErrorPatternsQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/GetKnownErrorPatternsQuery.js";
import { PatternResponse } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/PatternResponse.js";
import { GetForecastMeasurementQuery } from "../../../../../../Contexts/Monitoring/Forecast/application/GetForecastMeasurement/GetForecastMeasurementQuery.js";
import { ForecastMeasurementResponse } from "../../../../../../Contexts/Monitoring/Forecast/application/GetForecastMeasurement/GetForecastMeasurementUseCase.js";

export class AnalyticsGetController {
  constructor(private readonly queryBus: QueryBus) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await this.queryBus.ask<AnalyticsResponse>(
        new GetAnalyticsQuery(),
      );
      // 昇格（結晶化）済みパターン数は学習ループの成果指標なので analytics に同梱する
      // （一覧上部のバリューストリップ・Analytics ページが読む。既存 query の再利用）。
      const patterns = await this.queryBus.ask<PatternResponse>(
        new GetKnownErrorPatternsQuery(),
      );
      // 予報の測定（E6）は **AnalyticsResponse には入れず**、同じレスポンスの別フィールドに置く。
      // 診断側（正答率・引用照合率）と分母の意味が違うので、同じ集計オブジェクトに混ぜない
      // ——混ぜた時点で「予報の照合率は定義上 100%」が診断側の率を汚す。
      const forecast = await this.queryBus.ask<ForecastMeasurementResponse>(
        new GetForecastMeasurementQuery(),
      );
      res.json({
        ...analytics,
        promotedPatternCount: patterns.patterns.filter((p) => p.isPromoted)
          .length,
        forecastMeasurement: forecast.measurement,
      });
    } catch (error) {
      next(error);
    }
  }
}
