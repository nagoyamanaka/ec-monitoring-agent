import { InvestigationContext } from "../../domain/InvestigationContext.js";

/**
 * LLMへ送るプロンプトの構築（プロバイダ非依存）。
 * systemInstruction は固定。userPrompt はトークン予算（3,500）を超えないよう
 * similarIncidents を動的に削減する。
 */

export const SYSTEM_INSTRUCTION = `あなたはECシステムの障害調査AIエージェントです。
提供された障害イベント・既知パターン・類似インシデント・インフラ証拠（InfraEvidence）を分析し、
必ずJSONフォーマットで回答してください。
errorEvent.severity はソースが観測時点で付与した事前重大度です。これを出発点（prior）とし、
証拠から見直す根拠がある場合のみ severity を変更してください。
suggestedActions には「どう直すか」の具体的な修正方針を含めてください（例: 依存パッケージの
バージョン更新なら "axios を 1.6.0 → 1.7.4 に更新 (CVE-XXXX)"）。これがユーザーが remediate を
実行するか判断する材料になります。
remediable は「自社コードの変更（依存更新・設定/コード修正）で直せ、PR 起票で対処可能」と
判断できる場合のみ true。インフラ手動対応・外部要因・運用対応が必要なものは false。
{
  "summary": "障害の説明（日本語・1〜2文）",
  "confidence": 0.87,
  "severity": "CRITICAL" | "WARNING" | "INFO",
  "investigationSteps": ["調べたこと1", "調べたこと2"],
  "suggestedActions": ["対応アクション1（具体的な修正方針）", "対応アクション2"],
  "suggestedPatternName": "自動昇格候補のパターン名（例: DB_CONNECTION_EXHAUSTION）",
  "remediable": true | false
}`;

const MAX_ESTIMATED_TOKENS = 3500;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildUserPrompt(context: InvestigationContext): string {
  const full = JSON.stringify(
    {
      errorEvent: context.errorEvent,
      knownPatterns: context.knownPatterns,
      similarIncidents: context.similarIncidents,
      ...(context.infraEvidence ? { infraEvidence: context.infraEvidence } : {}),
    },
    null,
    2,
  );

  if (estimateTokens(SYSTEM_INSTRUCTION + full) <= MAX_ESTIMATED_TOKENS) {
    return full;
  }

  return JSON.stringify(
    {
      errorEvent: context.errorEvent,
      knownPatterns: context.knownPatterns,
      similarIncidents: [],
      ...(context.infraEvidence ? { infraEvidence: context.infraEvidence } : {}),
    },
    null,
    2,
  );
}
