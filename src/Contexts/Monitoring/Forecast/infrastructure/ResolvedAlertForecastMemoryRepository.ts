import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { Filters } from "../../../Shared/domain/criteria/Filters.js";
import { Order } from "../../../Shared/domain/criteria/Order.js";
import { Logger } from "../../../Shared/domain/logging/Logger.js";
import { Alert } from "../../AlertAnalysis/domain/Alert.js";
import { AlertRepository } from "../../AlertAnalysis/domain/AlertRepository.js";
import {
  ForecastMemoryEntry,
  ForecastMemoryRepository,
} from "../domain/ForecastMemory.js";
import { deriveForecastSubject, subjectsMatch } from "../domain/forecastSubject.js";

// 投影対象の取得上限。デモ規模では全件に等しい（超えたら古い分が漏れるだけ＝予兆は縮退可）。
const WARM_UP_LIMIT = 500;

// 解決済み Alert（status=RESOLVED のアーカイブ／正解フィードバック済み）から subject を
// タグ付けした ForecastMemory 投影。最小実装＝warmUp でメモリに保持する。
// stretchⅢ では投影元を Mongo(Resolved) → EventLogRepository に差し替える（findBySubjects はノータッチ）。
export class ResolvedAlertForecastMemoryRepository implements ForecastMemoryRepository {
  private entries: ForecastMemoryEntry[] = [];

  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly logger: Logger,
  ) {}

  async warmUp(): Promise<void> {
    try {
      const alerts = await this.alertRepository.findByCriteria(
        new Criteria(new Filters([]), Order.none(), WARM_UP_LIMIT),
      );
      this.entries = alerts
        .map((alert) => this.toEntry(alert))
        .filter((entry): entry is ForecastMemoryEntry => entry !== null);
      await this.logger.info({
        service: "backoffice-backend",
        action: "forecast_memory_warmed",
        message: `ForecastMemory 投影完了：${this.entries.length}件`,
      });
    } catch (error) {
      // 予兆は read-only の付加機能＝投影失敗で起動を止めない（空のまま縮退）。
      this.entries = [];
      await this.logger.warn({
        service: "backoffice-backend",
        action: "forecast_memory_warmup_failed",
        message: `ForecastMemory 投影に失敗しました（空で継続）：${(error as Error).message}`,
      });
    }
  }

  async findBySubjects(subjects: string[]): Promise<ForecastMemoryEntry[]> {
    return this.entries.filter((entry) =>
      subjects.some((subject) => subjectsMatch(subject, entry.subject)),
    );
  }

  // 解決済み（RESOLVED アーカイブ or 正解フィードバック済み）かつレポート付きの Alert のみ投影する。
  private toEntry(alert: Alert): ForecastMemoryEntry | null {
    const primitives = alert.toPrimitives();
    const report = primitives.investigationReport;
    if (!report) return null;
    const isResolved =
      primitives.status === "RESOLVED" || primitives.feedback?.isCorrect === true;
    if (!isResolved) return null;

    // 調査時に埋めた subject（F2 以降の新データ）を優先し、旧データは同じ規約で導出する。
    const subject =
      report.subject ??
      deriveForecastSubject({
        suggestedPatternName: report.suggestedPatternName,
        category: primitives.monitoringEvent.category,
      });
    if (subject === "") return null;

    return {
      incidentId: primitives.id,
      subject,
      trigger: primitives.monitoringEvent.eventName,
      // resolvedNote と同じ規約：オペレーターのメモ優先・無ければ AI調査 summary。
      outcome: primitives.feedback?.operatorNote ?? report.summary,
    };
  }
}
