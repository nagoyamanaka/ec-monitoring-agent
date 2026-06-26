import { LlmAgent } from "@google/adk";

/**
 * 根本原因分析の専門エージェント（推論のみ・ツール無し）。
 * 集まった証拠と類似インシデントから、根本原因の仮説・確度・根拠（引用）を出す。
 * 確証に証拠が足りない場合は「何が足りないか」を明示して返し、コーディネーターに
 * evidence_collector での追加収集を促す（＝自律ループの判断役）。
 */
export function createRootCauseAnalystAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: "root_cause_analyst",
    model,
    description:
      "証拠と類似インシデントから根本原因の仮説・確度・根拠を出す分析専門エージェント。",
    instruction: `あなたは障害の根本原因アナリストです。与えられた障害イベント・収集済み証拠・類似インシデントを
読み解き、最も確からしい根本原因の仮説と、その確度（0〜1）、判断根拠（どの証拠/事例に基づくか）を
述べてください。証拠が不足して確度が低い場合は、断定せず「確証には〇〇の証拠が必要」と不足を明示して
ください。証拠に無いことを推測で断定しないこと。`,
  });
}
