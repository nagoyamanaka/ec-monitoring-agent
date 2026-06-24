import type { AlertsApi } from "../infrastructure/alertsApi";

/**
 * オペレータの「却下して AI に再調査させる」操作を再調査 POST へ橋渡しする application ユースケース。
 * 人間の指摘（何が違うか・どう直すか）を operatorNote として AI 再調査の文脈へ渡す一点に責務を絞る。
 * 二値フィードバック（submitFeedback）とは別経路＝学習シグナルを濁さない「やり直し」。
 * 結果（ANALYZING→OPEN ＋ 新レポート）は SSE で届くため、ここは 202 を待つだけ。
 */

export type ReinvestigateCommand = {
  readonly alertId: string;
  readonly operatorNote: string;
};

export async function reinvestigate(
  api: AlertsApi,
  command: ReinvestigateCommand,
  signal?: AbortSignal,
): Promise<void> {
  const note = command.operatorNote.trim();
  await api.reinvestigate(command.alertId, { operatorNote: note }, signal);
}
