import { ForecastSignal } from "./ForecastSignal.js";
import { RiskForecast } from "./RiskForecast.js";
import {
  ForecastBriefingPrimitives,
  ForecastSignalPrimitives,
} from "./contracts/ForecastContract.js";

// 予報と、その根拠に使ったシグナル全量のセット（read-model）。
// citations は ForecastSignal.id を指すため、予報単体では引用チップ（F7）が
// 「何を引用したのか」を解決できない＝シグナルを同梱して保存・配信する。
export type ForecastBriefing = {
  readonly forecast: RiskForecast;
  readonly signals: ForecastSignal[];
};

// 最新予報の保存と照会（最小実装はメモリ最新1件）。
// GET /forecast は事前生成済みのこれを返す＝審査員の非同期閲覧に Gemini 待ちゼロで耐える。
export interface RiskForecastRepository {
  saveLatest(briefing: ForecastBriefing): Promise<void>;
  findLatest(): Promise<ForecastBriefing | null>;
}

// wire 変換（Date→ISO文字列のみ・純関数）。frontend は contracts の Primitives を直接 import する。
export function toForecastBriefingPrimitives(
  briefing: ForecastBriefing,
): ForecastBriefingPrimitives {
  return {
    forecast: {
      forecastId: briefing.forecast.forecastId,
      generatedAt: briefing.forecast.generatedAt.toISOString(),
      horizon: briefing.forecast.horizon,
      risks: briefing.forecast.risks.map((risk) => ({
        window: risk.window,
        subject: risk.subject,
        level: risk.level,
        confidence: risk.confidence,
        citations: [...risk.citations],
        reasoning: risk.reasoning,
      })),
      isFallback: briefing.forecast.isFallback,
    },
    signals: briefing.signals.map(
      (signal): ForecastSignalPrimitives => ({
        id: signal.id,
        kind: signal.kind,
        subject: signal.subject,
        when: signal.when,
        desc: signal.desc,
        source: signal.source,
        ...(signal.url ? { url: signal.url } : {}),
      }),
    ),
  };
}
