import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetAnalyticsQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/GetAnalyticsQuery.js";
import { AnalyticsResponse } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/AnalyticsResponse.js";
import { GetKnownErrorPatternsQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/GetKnownErrorPatternsQuery.js";
import { PatternResponse } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/PatternResponse.js";

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
      res.json({
        ...analytics,
        promotedPatternCount: patterns.patterns.filter((p) => p.isPromoted)
          .length,
      });
    } catch (error) {
      next(error);
    }
  }
}
