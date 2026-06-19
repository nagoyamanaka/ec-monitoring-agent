import { InvestigationContext } from "../../domain/InvestigationContext.js";

/**
 * LLMへ送るプロンプトの構築（プロバイダ非依存）。
 * systemInstruction は固定。userPrompt はトークン予算（3,500）を超えないよう
 * similarIncidents を動的に削減する。
 */

export const SYSTEM_INSTRUCTION = `あなたはECシステムの障害調査AIエージェントです。
提供された障害イベント・既知パターン・類似インシデント・インフラ証拠（InfraEvidence）を分析し、
必ずJSONフォーマットで回答してください。
{
  "summary": "障害の説明（日本語・1〜2文）",
  "confidence": 0.87,
  "severity": "CRITICAL" | "WARNING" | "INFO",
  "investigationSteps": ["調べたこと1", "調べたこと2"],
  "suggestedActions": ["対応アクション1", "対応アクション2"],
  "suggestedPatternName": "自動昇格候補のパターン名（例: DB_CONNECTION_EXHAUSTION）"
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
