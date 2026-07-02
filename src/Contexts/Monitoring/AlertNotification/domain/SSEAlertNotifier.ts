import { Response } from "express";
import { AlertPrimitives } from "../../AlertAnalysis/domain/Alert.js";
import { RemediationResponsePrimitives } from "../../AIInvestigation/domain/contracts/RemediationContract.js";
import { InvestigationProgressPrimitives } from "../../AIInvestigation/domain/contracts/InvestigationProgressContract.js";

/**
 * SSE broadcast の出口。アラート集約のライフサイクル事象（小さく全クライアント共通の事実）を push する。
 * - notify: 既定イベント（alert の生成/分析中/調査完了/dedup 更新）。AlertPrimitives を配る。
 * - notifyRemediation: 名前付きイベント "remediation"。リメディ確定（dispatched→drafted/failed 等）を配る。
 * - notifyInvestigationProgress: 名前付きイベント "investigation-progress"。ADK 調査の実行イベント
 *   （どのエージェントがどのツールを呼んだか）をライブ中継する（タスク E1(b)・実イベントのみ）。
 *   AIInvestigation 側の InvestigationProgressNotifier ポートを同名メソッドで構造的に満たす。
 *   重い外部証拠（Cloud Logging/Terraform/GitHub）はここで broadcast せず pull on-demand に残す。
 */
export interface SSEAlertNotifier {
  notify(alertPrimitives: AlertPrimitives): void;
  notifyRemediation(remediation: RemediationResponsePrimitives): void;
  notifyInvestigationProgress(progress: InvestigationProgressPrimitives): void;
  addConnection(res: Response): void;
  removeConnection(res: Response): void;
}
