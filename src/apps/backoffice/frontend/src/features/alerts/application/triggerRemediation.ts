import type { RemediationApi } from "../infrastructure/remediationApi";

/**
 * オペレータの「修正を起票」操作を POST /remediation/draft-pr へ橋渡しする application ユースケース。
 * 起票は read（調査）と分離した write アクションで、最終ゲートは人間承認＝この操作そのもの（step4-1 §4）。
 * 202 受付のみ返るため、呼び出し側は成功後に getRemediation で再取得して状態を反映する（共通原則）。
 */
export async function triggerRemediation(
  api: RemediationApi,
  alertId: string,
  signal?: AbortSignal,
): Promise<void> {
  await api.draftRemediation(alertId, signal);
}
