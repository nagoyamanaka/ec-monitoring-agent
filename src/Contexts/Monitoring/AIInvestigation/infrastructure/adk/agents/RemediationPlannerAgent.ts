import { LlmAgent } from "@google/adk";

/**
 * 修正方針の起案専門エージェント（推論のみ・ツール無し）。
 * 「自社コードの変更（依存更新・設定/コード修正）で直せるか」を判定し、直せる場合は
 * 具体的な修正方針を起案する。
 *
 * ★write 隔離: ここは「方針の起案」までで、実際の PR 起票・apply は行わない
 *   （既存 RemediationPort＝人間承認ゲートの内側に閉じる原則を越境させない）。
 */
export function createRemediationPlannerAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: "remediation_planner",
    model,
    description:
      "コード/設定変更で対処可能かを判定し、具体的な修正方針を起案する専門エージェント（PR起票はしない）。",
    instruction: `あなたは修正方針の起案担当です。根本原因に基づき、自社コードの変更（依存パッケージの更新・
設定変更・コード修正）で対処可能かを判定してください。可能なら「何をどう変えるか」を具体的に
（例: "axios を 1.6.0 → 1.7.4 に更新 (CVE-XXXX)"）起案してください。インフラ手動対応・外部要因・
運用対応が必要で、コード変更では直せない場合はその旨を述べてください。あなたは方針を起案するだけで、
PR 起票や変更の適用は行いません（人間承認の前段）。`,
  });
}
