import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { ForecastContext } from "../../domain/ForecastContext.js";
import { ForecastPort } from "../../domain/ForecastPort.js";
import { RiskForecast, RiskItem } from "../../domain/RiskForecast.js";

/**
 * 集め終わった入力（ForecastContext）から予報を出す部分＝予報器の本体。
 * 生成（ForecastRiskUseCase）とリプレイ（T0-2・ReplayForecastUseCase）が同じこのクラスを通る
 * ＝リプレイは「入力の出どころ」だけが違い、予報の出し方は本番と1行も変わらない。
 * ここを変えたら FORECAST_PIPELINE_RULES（ForecastRiskUseCase.ts）の記述も直すこと。
 */
export class ForecastSynthesis {
  constructor(
    private readonly forecastPort: ForecastPort,
    private readonly logger: Logger,
  ) {}

  async forecast(context: ForecastContext): Promise<RiskForecast> {
    const forecast = await this.forecastPort.forecast(context);
    return this.verifyCitations(forecast, context);
  }

  /**
   * 引用検証（ハルシネーション・ガード）: citations を実在する ForecastSignal.id に照合し、
   * 実在しない id（偽引用）は落とす。裏付けが1つも残らないリスクは丸ごと落とす
   * （citations 空＝「証拠なき主張」を表示前に排除。impact の citations 必須ガードと同方針）。
   */
  private async verifyCitations(
    forecast: RiskForecast,
    context: ForecastContext,
  ): Promise<RiskForecast> {
    const signalIds = new Set(context.signals.map((signal) => signal.id));
    const verifiedRisks: RiskItem[] = [];
    // 破棄側の会計（E6-1）。判定は変えず、今まで捨てていたローカル値を予報に載せるだけ。
    let citationsEmitted = 0;
    let citationsDropped = 0;
    for (const risk of forecast.risks) {
      citationsEmitted += risk.citations.length;
      const verified = await this.verifyRisk(risk, signalIds);
      if (verified) {
        citationsDropped += risk.citations.length - verified.citations.length;
        verifiedRisks.push(verified);
      } else {
        // 丸ごと破棄したリスクの引用は全部「実在しなかった」か、あるいは最初から空。
        citationsDropped += risk.citations.length;
      }
    }
    return {
      ...forecast,
      risks: verifiedRisks,
      verification: {
        citationsEmitted,
        citationsDropped,
        risksEmitted: forecast.risks.length,
        risksDropped: forecast.risks.length - verifiedRisks.length,
      },
    };
  }

  // 1リスクぶんの照合。偽引用は citations から除き、裏付けゼロなら null（破棄）を返す。
  private async verifyRisk(
    risk: RiskItem,
    signalIds: ReadonlySet<string>,
  ): Promise<RiskItem | null> {
    const validCitations = risk.citations.filter((id) => signalIds.has(id));
    const fakeCitations = risk.citations.filter((id) => !signalIds.has(id));

    if (fakeCitations.length > 0) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "forecast_fake_citation_dropped",
        message: `実在しない引用を検出し破棄しました: subject=${risk.subject}, fake=[${fakeCitations.join(", ")}], valid=${validCitations.length}件`,
      });
    }
    if (validCitations.length === 0) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "forecast_uncited_risk_dropped",
        message: `裏付けシグナルの無いリスクを破棄しました（証拠なき主張は出さない）: subject=${risk.subject}, level=${risk.level}`,
      });
      return null;
    }
    return { ...risk, citations: validCitations };
  }
}
