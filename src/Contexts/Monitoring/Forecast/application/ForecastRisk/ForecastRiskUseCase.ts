import { randomUUID } from "node:crypto";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { ForecastBriefing, RiskForecastRepository } from "../../domain/ForecastBriefing.js";
import { ForecastMemoryEntry, ForecastMemoryRepository } from "../../domain/ForecastMemory.js";
import { ForecastPort } from "../../domain/ForecastPort.js";
import { ForecastSignal, ForecastSignalKind } from "../../domain/ForecastSignal.js";
import { ForecastSignalSource } from "../../domain/ForecastSignalSource.js";
import { RiskForecast, RiskItem } from "../../domain/RiskForecast.js";

/**
 * 予兆ブリーフィングの生成（全依存 read-only・write ゼロ）。
 * ★継ぎ目（step4-1 §7.9）: stretchⅢ は signalSources に EventLogPrecursorSource を
 * 足すだけで本 UseCase はノータッチ。記憶（MEMORY）は subject 駆動なので配列反復と別ステップ。
 */
export class ForecastRiskUseCase {
  constructor(
    private readonly signalSources: ForecastSignalSource[],
    private readonly forecastMemory: ForecastMemoryRepository,
    private readonly forecastPort: ForecastPort,
    private readonly riskForecastRepository: RiskForecastRepository,
    private readonly logger: Logger,
  ) {}

  async run(params: { horizon: string }): Promise<void> {
    const { horizon } = params;

    const signals = await this.collectSignals(horizon);
    if (signals.length === 0) {
      await this.saveEmptyForecast(horizon);
      return;
    }

    const forecast = await this.forecastPort.forecast({ horizon, signals });
    const verified = await this.verifyCitations(forecast, signals);
    await this.saveBriefing(verified, signals);
  }

  /**
   * LLM 突合の母集団を集める: 主シグナル（未来の変更・スケジュール）＋
   * その subject に紐づく記憶（過去の解決済みインシデント）。
   */
  private async collectSignals(horizon: string): Promise<ForecastSignal[]> {
    const primarySignals = await this.collectPrimarySignals(horizon);
    const memorySignals = await this.recallMemorySignals(primarySignals);
    return [...primarySignals, ...memorySignals];
  }

  // 源単位の失敗は各 Source 内で空縮退済み（1源の失敗で予報全体を落とさない）。
  private async collectPrimarySignals(horizon: string): Promise<ForecastSignal[]> {
    const collected = await Promise.all(
      this.signalSources.map((source) => source.collect(horizon)),
    );
    return collected.flat();
  }

  // 主シグナルの subject（重複除去済み）で記憶を引き、MEMORY シグナルへ正規化する。
  private async recallMemorySignals(
    primarySignals: ForecastSignal[],
  ): Promise<ForecastSignal[]> {
    if (primarySignals.length === 0) return [];
    const subjects = [...new Set(primarySignals.map((signal) => signal.subject))];
    const memories = await this.forecastMemory.findBySubjects(subjects);
    return memories.map((memory, index) => this.toMemorySignal(memory, index));
  }

  private toMemorySignal(memory: ForecastMemoryEntry, index: number): ForecastSignal {
    return {
      id: `inc-${index + 1}`,
      kind: ForecastSignalKind.MEMORY,
      subject: memory.subject,
      when: "過去の解決済みインシデント",
      desc: `${memory.trigger} → ${memory.outcome}`,
      // incidentId は実在 Alert id（SimilarIncident.sourceAlertId 由来）＝引用を実在 Alert に解決できる。
      source: `incident.${memory.incidentId}`,
    };
  }

  /**
   * 引用検証（ハルシネーション・ガード）: citations を実在する ForecastSignal.id に照合し、
   * 実在しない id（偽引用）は落とす。裏付けが1つも残らないリスクは丸ごと落とす
   * （citations 空＝「証拠なき主張」を表示前に排除。impact の citations 必須ガードと同方針）。
   */
  private async verifyCitations(
    forecast: RiskForecast,
    signals: ForecastSignal[],
  ): Promise<RiskForecast> {
    const signalIds = new Set(signals.map((signal) => signal.id));
    const verifiedRisks: RiskItem[] = [];
    for (const risk of forecast.risks) {
      const verified = await this.verifyRisk(risk, signalIds);
      if (verified) verifiedRisks.push(verified);
    }
    return { ...forecast, risks: verifiedRisks };
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

  // シグナル同梱の ForecastBriefing として最新1件を保存（引用チップの解決先を配信に含める）。
  private async saveBriefing(
    forecast: RiskForecast,
    signals: ForecastSignal[],
  ): Promise<void> {
    const briefing: ForecastBriefing = { forecast, signals };
    await this.riskForecastRepository.saveLatest(briefing);
    await this.logger.info({
      service: "backoffice-backend",
      action: "forecast_generated",
      message: `予報を保存しました: horizon=${forecast.horizon}, signals=${signals.length}, risks=${forecast.risks.length}, isFallback=${forecast.isFallback}`,
    });
  }

  // シグナルゼロは失敗ではなく「材料が無い」＝ LLM を呼ばず空予報を保存（課金ゼロ・決定的）。
  private async saveEmptyForecast(horizon: string): Promise<void> {
    await this.logger.info({
      service: "backoffice-backend",
      action: "forecast_no_signals",
      message: `予兆シグナルが0件のため空予報を保存しました（Gemini 非呼び出し）: horizon=${horizon}`,
    });
    await this.riskForecastRepository.saveLatest({
      forecast: {
        forecastId: randomUUID(),
        generatedAt: new Date(),
        horizon,
        risks: [],
        isFallback: false,
      },
      signals: [],
    });
  }
}
