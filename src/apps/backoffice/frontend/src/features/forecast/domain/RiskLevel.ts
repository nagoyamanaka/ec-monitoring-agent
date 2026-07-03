/**
 * 予兆リスクのレベル（step6 F7）。純関数のみ・I/Oゼロ。
 * backend（GeminiForecastAdapter）は未知 level を LOW に丸めて返すが、
 * wire を信用しすぎない防御として frontend でも同じ「盛らない側」への正規化を持つ。
 */

export const RISK_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

/** 未知の文字列は LOW（盛らない側）へ丸める。 */
export function normalizeRiskLevel(raw: string): RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(raw)
    ? (raw as RiskLevel)
    : "LOW";
}

const RANK: Record<RiskLevel, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };

export function riskLevelRank(level: RiskLevel): number {
  return RANK[level];
}

/**
 * level 降順（HIGH→LOW）→ confidence 降順の表示順比較。
 * backend（アダプタ）がソート済みで返す契約だが、一覧の並びは UI の責務としても保証する。
 */
export function compareRiskDesc(
  a: { level: RiskLevel; confidence: number },
  b: { level: RiskLevel; confidence: number },
): number {
  const byLevel = riskLevelRank(b.level) - riskLevelRank(a.level);
  if (byLevel !== 0) return byLevel;
  return b.confidence - a.confidence;
}

/** リスクレベルの日本語ラベル（バッジは英字のまま、説明文・aria 用）。 */
const LEVEL_LABELS: Record<RiskLevel, string> = {
  HIGH: "高リスク",
  MEDIUM: "中リスク",
  LOW: "低リスク",
};

export function riskLevelLabel(level: RiskLevel): string {
  return LEVEL_LABELS[level];
}
