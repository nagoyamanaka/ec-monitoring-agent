import { LlmAgent, FunctionTool } from "@google/adk";

/**
 * 証拠収集の専門エージェント。read-only ツール（Cloud Logging / Terraform / GitHub /
 * 類似インシデントDB）だけを持ち、コーディネーターから渡された仮説/問いに対して、
 * 必要な証拠を狙い撃ちで収集して要約を返す。
 *
 * ★これが「自律的証拠追加収集ループ」の手足。書き込みツールは持たない。
 */
export function createEvidenceCollectorAgent(
  model: string,
  tools: FunctionTool[],
): LlmAgent {
  return new LlmAgent({
    name: "evidence_collector",
    model,
    description:
      "Cloud Logging / Terraform / GitHub / 類似インシデントDB から読み取り専用で追加証拠を収集する専門エージェント。",
    instruction: `あなたは障害調査の証拠収集担当です。与えられた問い・仮説に対し、保有ツールを使って
読み取り専用で証拠を集めてください。対象サービス名・時刻(ISO 8601)・検索語を適切に絞って呼ぶこと。
複数ツールを組み合わせてよい。収集できた具体的な事実（ログ行・差分・コミット・類似事例）を簡潔に
要約して返してください。証拠が見つからなければ「該当なし」と返すこと。推測で事実を作らないこと。`,
    tools,
  });
}
