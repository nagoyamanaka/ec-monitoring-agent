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
  // 「コードで直せるか」の AI 判定。未指定・型不正は false に丸める（必須スキーマには含めない）。
  remediable: boolean;
};

/**
 * 配列要素を文字列のみへ正規化する。LLM が誤って文字列以外（オブジェクト・数値）を混ぜても
 * 落とす防御。href/kind はここでは受け取らない（リンクは LLM ではなく evidence から決定的に
 * 導出する＝ハルシネーション URL を排除する。`evidenceLinks` 参照）。
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

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
      investigationSteps: toStringArray(parsed["investigationSteps"]),
      suggestedActions: toStringArray(parsed["suggestedActions"]),
      suggestedPatternName: parsed["suggestedPatternName"] as string,
      remediable: parsed["remediable"] === true,
    };
  } catch {
    return null;
  }
}
