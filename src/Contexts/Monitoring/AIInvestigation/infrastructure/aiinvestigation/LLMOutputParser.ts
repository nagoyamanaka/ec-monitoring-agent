/**
 * LLMの生テキスト出力を、検証済みの構造化スキーマへ変換する（プロバイダ非依存）。
 * ```json フェンス／素のJSONどちらにも対応し、スキーマ不一致・パース失敗時は null を返す。
 */

/** LLMに固定出力させる調査結果のスキーマ。 */
export type LLMInvestigationOutput = {
  summary: string;
  confidence: number;
  severity: string;
  investigationSteps: string[];
  suggestedActions: string[];
  suggestedPatternName: string;
};

export function parseLLMOutput(text: string): LLMInvestigationOutput | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(jsonStr.trim()) as Record<string, unknown>;

    if (
      typeof parsed["summary"] !== "string" ||
      typeof parsed["confidence"] !== "number" ||
      typeof parsed["severity"] !== "string" ||
      !Array.isArray(parsed["investigationSteps"]) ||
      !Array.isArray(parsed["suggestedActions"]) ||
      typeof parsed["suggestedPatternName"] !== "string"
    ) {
      return null;
    }

    return {
      summary: parsed["summary"] as string,
      confidence: parsed["confidence"] as number,
      severity: parsed["severity"] as string,
      investigationSteps: parsed["investigationSteps"] as string[],
      suggestedActions: parsed["suggestedActions"] as string[],
      suggestedPatternName: parsed["suggestedPatternName"] as string,
    };
  } catch {
    return null;
  }
}
