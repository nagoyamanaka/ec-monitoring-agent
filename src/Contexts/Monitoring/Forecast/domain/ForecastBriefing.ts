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

// 予報の保存と照会。**生成のたびに1件追記**し、読み取りは最新1件だけを返す。
// GET /forecast は事前生成済みのこれを返す＝審査員の非同期閲覧に Gemini 待ちゼロで耐える。
// 追記型なのは測定のため: 予報の level 分布・引用の破棄件数は「過去に何を出したか」の
// 標本が要る（上書き保存では母数が常に 1）。
export interface RiskForecastRepository {
  /** 生成のたびに1件追記する（上書きしない＝履歴がそのまま測定の標本になる）。 */
  append(briefing: ForecastBriefing): Promise<void>;
  findLatest(): Promise<ForecastBriefing | null>;
  /**
   * 生成済み予報を未生成状態に戻す（デモ卓のリセット・F12）。
   * **履歴は消さない**——読み取り対象から外すだけ。デモ卓のリセット1回で測定の標本が
   * 消えると、追記にした意味が無くなるため。
   */
  clear(): Promise<void>;
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
        ...(risk.preventiveAction ? { preventiveAction: risk.preventiveAction } : {}),
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
