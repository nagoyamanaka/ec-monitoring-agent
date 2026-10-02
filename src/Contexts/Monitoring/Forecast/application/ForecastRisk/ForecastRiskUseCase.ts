import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { ForecastBriefing, RiskForecastRepository } from "../../domain/ForecastBriefing.js";
import { ForecastContext } from "../../domain/ForecastContext.js";
import { ForecastId } from "../../domain/ForecastId.js";
import { ForecastMemoryEntry, ForecastMemoryRepository } from "../../domain/ForecastMemory.js";
import { ForecastPort } from "../../domain/ForecastPort.js";
import { ForecastSignal, ForecastSignalKind } from "../../domain/ForecastSignal.js";
import { ForecastSignalSource } from "../../domain/ForecastSignalSource.js";
import { RiskForecast } from "../../domain/RiskForecast.js";
import { EvidenceSnapshotRecorder } from "./EvidenceSnapshotRecorder.js";
import { ForecastLedgerRecorder } from "./ForecastLedgerRecorder.js";
import { ForecastSynthesis } from "./ForecastSynthesis.js";
import {
  countMemoryCitedRisks,
  formatLevels,
} from "../../domain/riskLevelBreakdown.js";

// forecasterVersion のハッシュ入力（T0-1）。予報の結果を変える**コード上の規則**の一覧。
// プロンプトと違って規則はコードに埋まっていて内容ハッシュに乗らないので、ここに書き出す。
// ForecastSynthesis の verifyCitations と下の dedupeByEvidenceUrl / recallMemorySignals を変えたら、この記述も直すこと。
export const FORECAST_PIPELINE_RULES = [
  "citations: drop ids not in collected signals; drop risk with 0 valid citations",
  "dedupe: one signal per url; terraform.plan wins over other sources",
  "memory: recall MEMORY signals by subjects of primary signals",
] as const;

/**
 * 予兆ブリーフィングの生成（全依存 read-only・write ゼロ）。
 * ★継ぎ目（step4-1 §7.9）: stretchⅢ は signalSources に EventLogPrecursorSource を
 * 足すだけで本 UseCase はノータッチ。記憶（MEMORY）は subject 駆動なので配列反復と別ステップ。
 */
export class ForecastRiskUseCase {
  private readonly synthesis: ForecastSynthesis;

  constructor(
    private readonly signalSources: ForecastSignalSource[],
    private readonly forecastMemory: ForecastMemoryRepository,
    forecastPort: ForecastPort,
    private readonly riskForecastRepository: RiskForecastRepository,
    private readonly logger: Logger,
    // 発火した risk を台帳へ追記する（T0-1）。予報の出し方には関与しない。
    private readonly forecastLedger: ForecastLedgerRecorder,
    // 予報器に渡す入力を凍結する（T0-2）。これも予報の出し方には関与しない。
    private readonly evidenceSnapshots: EvidenceSnapshotRecorder,
  ) {
    this.synthesis = new ForecastSynthesis(forecastPort, logger);
  }

  async run(params: { horizon: string }): Promise<void> {
    const { horizon } = params;

    const signals = await this.collectSignals(horizon);
    if (signals.length === 0) {
      await this.saveEmptyForecast(horizon);
      return;
    }

    const context: ForecastContext = { horizon, signals };
    // 予報器を呼ぶ前に入力を固定する＝スナップショットは「予報時点で手元にあったもの」だけになる。
    const evidenceSnapshotId = await this.evidenceSnapshots.capture(context);
    const verified = await this.synthesis.forecast(context);
    await this.saveBriefing(verified, signals, evidenceSnapshotId);
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
    return this.dedupeByEvidenceUrl(collected.flat());
  }

  /**
   * 同一 url（＝同じ PR / 変更）を複数ソースが拾うと二重引用に見える。
   * 例: 未適用 plan（terraform.plan・plan-1）と open PR（github.pr・pr-83）が
   * どちらも同じ #83 を指す＝「plan済み未適用」と「未マージPR」で二重計上に見える。
   * url 単位で1本に畳み、terraform.plan（リソース差分まで持つ具体証拠＝flagship の
   * 「plan済み未適用」レーン）を open PR より優先して残す。最初の出現位置は保つ。
   * url を持たない signal・url が異なる signal（別 PR の pr-55 等）はそのまま通す。
   */
  private dedupeByEvidenceUrl(signals: ForecastSignal[]): ForecastSignal[] {
    const winnerByUrl = new Map<string, ForecastSignal>();
    for (const signal of signals) {
      if (!signal.url) continue;
      const current = winnerByUrl.get(signal.url);
      if (!current || this.evidencePriority(signal) > this.evidencePriority(current)) {
        winnerByUrl.set(signal.url, signal);
      }
    }
    const emitted = new Set<string>();
    const result: ForecastSignal[] = [];
    for (const signal of signals) {
      if (!signal.url) {
        result.push(signal);
        continue;
      }
      if (emitted.has(signal.url)) continue;
      emitted.add(signal.url);
      result.push(winnerByUrl.get(signal.url)!);
    }
    return result;
  }

  // terraform.plan（未適用 plan＝リソース差分まで持つ具体証拠）を open PR より優先。
  private evidencePriority(signal: ForecastSignal): number {
    return signal.source.startsWith("terraform.plan") ? 2 : 1;
  }

  // 主シグナルの subject（重複除去済み）で記憶を引き、MEMORY シグナルへ正規化する。
  private async recallMemorySignals(
    primarySignals: ForecastSignal[],
  ): Promise<ForecastSignal[]> {
    if (primarySignals.length === 0) return [];
    // 生成時点の最新投影へ更新してから引く。起動時 warmUp だけだと demo reset の再seed や
    // 直前に承認/解決した事例が記憶に載らず、MEMORY シグナルが起動時のまま固定されてしまう。
    await this.forecastMemory.warmUp();
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

  // シグナル同梱の ForecastBriefing として1件追記（引用チップの解決先を配信に含める）。
  private async saveBriefing(
    forecast: RiskForecast,
    signals: ForecastSignal[],
    evidenceSnapshotId: string,
  ): Promise<void> {
    const briefing: ForecastBriefing = { forecast, signals };
    await this.riskForecastRepository.append(briefing);
    await this.forecastLedger.record(briefing, evidenceSnapshotId);
    await this.logger.info({
      service: "backoffice-backend",
      action: "forecast_generated",
      // level 内訳と MEMORY 引用の有無を同じ行に出す（E6-3）。破棄側のログ
      // （forecast_uncited_risk_dropped）は level を持つのに、**生き残った側が持っていなかった**
      // ＝残ったリスクが強く出たのか弱く出たのかをログだけでは言えなかった非対称の解消。
      message: `予報を保存しました: horizon=${forecast.horizon}, signals=${signals.length}, risks=${forecast.risks.length}, levels=${formatLevels(forecast.risks)}, withMemoryCitation=${countMemoryCitedRisks(forecast.risks, signals)}, isFallback=${forecast.isFallback}`,
    });
  }

  // シグナルゼロは失敗ではなく「材料が無い」＝ LLM を呼ばず空予報を保存（課金ゼロ・決定的）。
  private async saveEmptyForecast(horizon: string): Promise<void> {
    await this.logger.info({
      service: "backoffice-backend",
      action: "forecast_no_signals",
      message: `予兆シグナルが0件のため空予報を保存しました（Gemini 非呼び出し）: horizon=${horizon}`,
    });
    await this.riskForecastRepository.append({
      forecast: {
        forecastId: ForecastId.random().value,
        generatedAt: new Date(),
        horizon,
        risks: [],
        isFallback: false,
      },
      signals: [],
    });
  }
}
