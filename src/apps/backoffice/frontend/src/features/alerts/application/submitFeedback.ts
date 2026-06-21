import type { AlertsApi, SubmitFeedbackInput } from "../infrastructure/alertsApi";

/**
 * オペレータの「承認／却下」操作を feedback の PATCH へ橋渡しする application ユースケース。
 * UI の語彙（approve/reject）を API のワイヤ語彙（isCorrect）へ正規化する一点に責務を絞る。
 * - approve = AI の分類が正しい（isCorrect: true）
 * - reject  = AI の分類が誤り（isCorrect: false）
 * 表示用整形は domain、HTTP は infrastructure が持ち、ここは「意思決定→入力」の写像のみ。
 */

export type FeedbackDecision = "approve" | "reject";

export type SubmitFeedbackCommand = {
  readonly alertId: string;
  readonly decision: FeedbackDecision;
  readonly operatorNote?: string;
};

/** decision を API の SubmitFeedbackInput へ正規化する純関数（テスト容易・UI 非依存）。 */
export function toFeedbackInput(
  decision: FeedbackDecision,
  operatorNote?: string,
): SubmitFeedbackInput {
  const note = operatorNote?.trim();
  return {
    isCorrect: decision === "approve",
    ...(note ? { operatorNote: note } : {}),
  };
}

/** 承認／却下を PATCH /alerts/:id/feedback として送信する。 */
export async function submitFeedback(
  api: AlertsApi,
  command: SubmitFeedbackCommand,
  signal?: AbortSignal,
): Promise<void> {
  const input = toFeedbackInput(command.decision, command.operatorNote);
  await api.submitFeedback(command.alertId, input, signal);
}
