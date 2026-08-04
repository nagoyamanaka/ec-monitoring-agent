import { EvidenceWeightedPromotionPolicy } from "@monitoring/AlertAnalysis/domain/promotion/EvidenceWeightedPromotionPolicy.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { ResolvedIncident } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { SimilarIncidentRepository } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { Alert, ReviewDecision } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";
import { crystallizePatternFromAlert } from "../../domain/promotion/crystallizePatternFromAlert.js";
import { PatternPromotionPolicy } from "../../domain/promotion/PatternPromotionPolicy.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

export class SubmitFeedbackUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly similarIncidentRepository: SimilarIncidentRepository,
    private readonly logger: Logger,
    // 昇格判定（いつ結晶化するか）は差し替え可能なドメインサービスへ委譲。
    //既定はソースの信頼性に応じた加重度で判定。
    private readonly promotionPolicy: PatternPromotionPolicy = new EvidenceWeightedPromotionPolicy(),
  ) {}

  async run(params: {
    alertId: AlertId;
    isCorrect: boolean;
    operatorNote?: string;
    // 人間が選んだ決裁。未指定なら Alert 側で isCorrect から導出する（derived として記録される）。
    decision?: ReviewDecision;
  }): Promise<void> {
    const { alertId, isCorrect, operatorNote, decision } = params;

    const alert = await this.alertRepository.findById(alertId);
    if (alert === null) {
      throw new MonitoringResourceNotFoundError("Alert", alertId.value);
    }

    // 再レビュー（判定のやり直し）に備え、直前の判定を見て遷移ベースで学習を反映する。
    // 「現在の判定が承認のときだけ解決済みインシデントが1件ある」状態を保つ。
    // 承認しても status は OPEN のまま（現役一覧・詳細に出し続ける）。承認＝対処済みの扱いは
    // dedup 側で担う（AnalyzeAlertUseCase は承認済みへは畳み込まず、再発火を新規アラートとして開く）。
    const wasApproved = alert.feedback?.isCorrect === true;
    const updatedAlert = alert.submitFeedback({
      isCorrect,
      operatorNote,
      decision,
    });
    await this.alertRepository.save(updatedAlert);

    if (isCorrect) {
      // 非承認→承認の遷移時のみ index（再承認での二重 index を防ぐ）。
      if (!wasApproved) {
        await this.indexAsResolved(updatedAlert, operatorNote);
      }
      await this.maybeAutoPromote(updatedAlert);
    } else if (wasApproved) {
      // 承認→却下のやり直し（誤承認の訂正）: 承認時に積んだ類似学習を撤回する。
      await this.withdrawResolved(updatedAlert);
    }

    await this.logger.info({
      service: "backoffice-backend",
      action: "feedback_submitted",
      message: `フィードバック受付：${alertId.value}, isCorrect=${isCorrect}`,
    });
  }

  // 承認の撤回時に、その Alert 由来の学習を撤回する:
  //  ① 類似学習（ResolvedIncident）の削除、② 自動昇格した KnownErrorPattern（結晶化）の削除。
  private async withdrawResolved(alert: Alert): Promise<void> {
    await this.similarIncidentRepository.removeByAlertId(alert.id.value);
    await this.knownErrorPatternRepository.removeBySourceAlertId(alert.id.value);
    await this.logger.info({
      service: "backoffice-backend",
      action: "feedback_resolved_withdrawn",
      message: `承認の撤回により類似学習・自動昇格を撤回：${alert.id.value}`,
    });
  }

  // 正解フィードバックを解決済みインシデントとしてインデックス登録する
  private async indexAsResolved(
    alert: Alert,
    operatorNote?: string,
  ): Promise<void> {
    const incident: ResolvedIncident = {
      eventName: alert.monitoringEvent.eventName,
      occurredOn: alert.monitoringEvent.occurredOn,
      // オペレーターのメモ＞AI調査summary＞汎用文字列の順でフォールバック。
      // AI調査結果は手元の alert に載っているので「どう直したか」を記憶に残す。
      resolvedNote:
        operatorNote ??
        alert.investigationReport?.summary ??
        "正解フィードバックによる解決",
      severity: alert.severity,
      // 元アラートへ辿れる back-link（UI ディープリンク用）
      sourceAlertId: alert.id.value,
    };
    await this.similarIncidentRepository.index(incident);
  }

  // 昇格判定（いつ）はポリシーに委譲し、満たせば既知パターンを構築・save（どう）する
  private async maybeAutoPromote(alert: Alert): Promise<void> {
    if (!this.promotionPolicy.shouldPromote(alert)) return;

    // 結晶化（Alert→KnownErrorPattern の焼き付け）は手動即時昇格と共通のファクトリに集約。
    // 自動昇格は AUTO_PROMOTED 接頭辞で由来を明示する。
    const pattern = crystallizePatternFromAlert(alert, "AUTO_PROMOTED");
    if (pattern === null) return; // ポリシーが保証済みだが型を絞るためのガード

    await this.knownErrorPatternRepository.save(pattern);

    await this.logger.info({
      service: "backoffice-backend",
      action: "pattern_auto_promoted",
      message: `パターン自動昇格（結晶化）：${alert.id.value}, pattern=${pattern.name}`,
    });
  }
}
