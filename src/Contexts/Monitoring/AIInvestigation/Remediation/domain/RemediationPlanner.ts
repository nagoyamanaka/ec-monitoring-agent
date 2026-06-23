import { RemediationInput } from "./RemediationInput.js";
import { RemediationPlan } from "./RemediationPlan.js";

/**
 * 脆弱性一覧 → 修正PR草案（タイトル/本文/ブランチ/ファイル変更）を生成する driven ポート。
 * 既定実装は LLM 委譲（AI が修正方針を起草）＋ LLM 不通時の決定論フォールバック。
 * AIInvestigationPort と同様、生成の信頼性とフォールバックは infrastructure の Adapter が担う。
 */
export interface RemediationPlanner {
  plan(input: RemediationInput): Promise<RemediationPlan>;
}
