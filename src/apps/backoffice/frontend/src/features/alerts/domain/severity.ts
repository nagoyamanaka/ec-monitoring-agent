import type { SeverityLevel } from "@shared/ui/SeverityBadge";
import type { AlertSeverity } from "./AlertView";

/**
 * severity・confidence の表示用 view-logic（純関数のみ）。
 * 色そのもの（Tailwind クラス / Tremor 色）は shared/ui（SeverityBadge・tremor/colors）が一元管理する。
 * ここは「どのランクか」「何 % か」というドメイン寄りの整形に限定し、配色の二重管理を避ける。
 */

/** AlertSeverity を SeverityBadge / rankColor が受け取るランクへ橋渡しする（AlertSeverity ⊂ SeverityLevel）。 */
export function severityToBadgeLevel(severity: AlertSeverity): SeverityLevel {
  return severity;
}

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

/** 危険度の重み。一覧を重大度の降順に並べる比較で使う。 */
export function severityWeight(severity: AlertSeverity): number {
  return SEVERITY_WEIGHT[severity];
}

/** 重大度の降順（CRITICAL→WARNING→INFO）で比較する純関数。 */
export function compareBySeverityDesc(
  a: AlertSeverity,
  b: AlertSeverity,
): number {
  return severityWeight(b) - severityWeight(a);
}

/** confidence(0..1) を 0..100 の整数 % に変換。null（未知・未分類）は null。 */
export function confidencePercent(confidence: number | null): number | null {
  if (confidence === null) return null;
  return Math.round(confidence * 100);
}

/** confidence(0..1) を "87%" 表記に整形。null は "—"。 */
export function formatConfidence(confidence: number | null): string {
  const percent = confidencePercent(confidence);
  return percent === null ? "—" : `${percent}%`;
}
