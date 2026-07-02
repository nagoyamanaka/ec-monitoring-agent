import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetAnalyticsQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/GetAnalyticsQuery.js";
import { AnalyticsResponse } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/AnalyticsResponse.js";
import { GetKnownErrorPatternsQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/GetKnownErrorPatternsQuery.js";
import { PatternResponse } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/PatternResponse.js";

// デモの現在状態（alert件数・seed済みパターン件数）を返す。既存 query を再利用。
export class DemoStatusGetController {
  constructor(private readonly queryBus: QueryBus) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await this.queryBus.ask<AnalyticsResponse>(new GetAnalyticsQuery());
      const patterns = await this.queryBus.ask<PatternResponse>(new GetKnownErrorPatternsQuery());
      res.json({
        demoEnabled: true,
        totalAlerts: analytics.totalAlerts,
        // 一覧（GET /alerts）と同じ軸の件数。UI の状態タイルはこちらを表示する
        // （totalAlerts は RESOLVED seed を含むため一覧と食い違う）。
        activeAlerts: analytics.activeAlertCount,
        promotedPatternCount: patterns.patterns.filter((p) => p.isPromoted).length,
        patternCount: patterns.patterns.length,
      });
    } catch (error) {
      next(error);
    }
  }
}
