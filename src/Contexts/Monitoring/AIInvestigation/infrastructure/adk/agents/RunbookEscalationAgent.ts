import { LlmAgent, FunctionTool } from "@google/adk";

/**
 * 他責/運用案件のエスカレーション草案を起案する専門エージェント。タスク35。
 *
 * 「コードで直せない他責/運用案件」を行き止まりにせず、想定オーナー/連絡先・暫定回避手順まで
 * 草案化する。RemediationPlanner（自責→コード/IaC PR）と排他で役割分担し、impact.fault が
 * external/運用のとき Coordinator から呼ばれる。
 *
 * ★write 隔離: 起案のみ。実際の通知送信・チケット起票は行わない（人間承認の前段。
 *   既存 RemediationPort と同じ「write は人間承認ゲートの内側」の原則を越境させない）。
 * ★宛先は推測しない: find_escalation_owners ツールで体制マスタを引いて team/owner/contact を
 *   裏付ける。ツールが宛先を返せない場合は team を空にして「宛先不明」を明示する（捏造禁止）。
 * ★暫定回避手順は過去の解決メモ（similarIncidents の resolvedNote）を根拠に組み、無ければ
 *   一般的な暫定対応に留める。
 */
export function createRunbookEscalationAgent(
  model: string,
  tools: FunctionTool[],
): LlmAgent {
  return new LlmAgent({
    name: "runbook_escalation",
    model,
    description:
      "他責/運用案件のエスカレーション草案（宛先・連絡先・暫定回避手順）を起案する専門エージェント（通知送信はしない）。",
    tools,
    instruction: `あなたは他責/運用案件のエスカレーション草案担当です。根本原因・impact（特に fault と
affectedSubjects）・体制マスタをもとに、運用チームへ引き継ぐ草案を作ってください。

1. find_escalation_owners ツールに impact.affectedSubjects を渡し、担当 team / owner / contact /
   slaTier を引きます。返ってきた宛先だけを使い、宛先を捏造しないこと。該当チームが無ければ team を
   空文字にして「宛先不明（要・手動振り分け）」を明示します。
2. interimWorkaround（暫定回避手順）は、与えられた類似インシデントの resolvedNote（過去にどう直したか）を
   根拠に具体化します。該当が無ければ一般的な暫定対応に留め、推測を断定で書きません。
3. severityRationale には、impact.scale と slaTier をもとに重大度の根拠を 1 文で書きます。
4. evidenceBundle には、引き継ぎに添付すべき証拠/引用の id（証拠ログ・類似事例・commit/terraform 差分の id）を
   列挙します。
5. reason には「なぜこのチーム/運用対応なのか」（fault=external/運用の根拠と affectedSubjects との対応）を
   1 文で書きます。

あなたは草案を作るだけで、通知送信・チケット起票・変更適用は一切行いません（人間承認の前段）。
結果は escalation = { team, owner, contact, reason, interimWorkaround, severityRationale, evidenceBundle }
の形でコーディネーターへ返してください。`,
  });
}
