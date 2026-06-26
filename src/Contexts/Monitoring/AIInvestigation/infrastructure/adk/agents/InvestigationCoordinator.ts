import { LlmAgent, AgentTool } from "@google/adk";
import { SYSTEM_INSTRUCTION } from "../../aiinvestigation/InvestigationPromptBuilder.js";

/**
 * 調査の統括（root / orchestrator）エージェント。hub-and-spoke の hub。
 * 専門エージェント（証拠収集 / 根本原因分析 / 修正起案）を AgentTool として保持し、
 * 「分析 →（不足なら）証拠追加収集 → 再分析」を確度が十分になるまで自律反復してから、
 * 既存の単一Gemini実装と同一スキーマの JSON を最終出力する。
 *
 * 出力スキーマ/判定ルールは単一Gemini版と共通化するため SYSTEM_INSTRUCTION を再利用し、
 * その上にオーケストレーション指示を重ねる（パース/マッピングは LLMInvestigationAdapter と共通）。
 */
export function createInvestigationCoordinator(params: {
  model: string;
  evidenceCollector: LlmAgent;
  rootCauseAnalyst: LlmAgent;
  remediationPlanner: LlmAgent;
}): LlmAgent {
  const orchestration = `

【あなたの役割：調査コーディネーター】
あなたは以下の専門エージェント（ツール）に委譲して自律的に調査を進めます:
- evidence_collector: Cloud Logging / Terraform / GitHub / 類似インシデントDB から読み取り専用で
  追加証拠を収集する。仮説の検証に証拠が足りないときに、対象サービス名・時刻(ISO 8601)・検索語を渡して呼ぶ。
- root_cause_analyst: 集めた証拠と類似インシデントから根本原因の仮説・確度・根拠を出す。
- remediation_planner: コード/設定変更で直せる場合に具体的な修正方針を起案する（PR起票はしない）。

手順:
1. まず root_cause_analyst で初期仮説と確度を得る。
2. 確証に証拠が不足していれば evidence_collector で狙い撃ちに証拠を追加収集し、再び root_cause_analyst で分析し直す。
   これを確度が十分になるか、これ以上証拠が得られないと判断するまで繰り返す。
3. 必要に応じて remediation_planner を呼び、修正可否と方針を得る。
4. 最後に、上で定義した JSON スキーマ「だけ」を出力する（前後に説明文・コードフェンス以外の地の文を付けない）。
   confidence は実際に積み上げた証拠の強さを反映させること。`;

  return new LlmAgent({
    name: "investigation_coordinator",
    model: params.model,
    description: "障害調査を統括し、専門エージェントに委譲して最終レポート(JSON)を出すコーディネーター。",
    instruction: SYSTEM_INSTRUCTION + orchestration,
    tools: [
      new AgentTool({ agent: params.evidenceCollector }),
      new AgentTool({ agent: params.rootCauseAnalyst }),
      new AgentTool({ agent: params.remediationPlanner }),
    ],
  });
}
