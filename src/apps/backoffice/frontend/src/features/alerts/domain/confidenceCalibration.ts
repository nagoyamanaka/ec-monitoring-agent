import type { ConfidenceGroundingSignal } from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import type { ConfidenceCalibrationView } from "./InvestigationReportView";

/**
 * 確信度キャリブレーション記録 → 表示文言への写像・純関数。
 * 数字は全て backend が記録した事実（シグナル・上限・自己申告）から導出し、
 * 「なぜこの確信度なのか」を人間の言葉で説明する（説明責任＝盛らない制約の表示側）。
 */

const SIGNAL_LABELS: Record<ConfidenceGroundingSignal, string> = {
  known_pattern: "既知パターン一致",
  cited_commit: "原因コミット引用",
  terraform_diff: "Terraform 変更",
  verifiable_cve: "実在 CVE 引用",
  related_alert: "相関アラート",
  similar_incident: "類似事例",
  operator_note: "人間の指摘",
};

export type CalibrationNote = {
  /** 裏付けの内訳と上限（例: "裏付け: 相関アラート・類似事例 ─ 上限 70%"）。 */
  readonly basis: string;
  /** 切り詰めが起きたときの補正説明。起きていなければ null（自己申告そのまま）。 */
  readonly adjustment: string | null;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function calibrationNote(
  calibration: ConfidenceCalibrationView,
  /** 表示中の確信度（＝補正後の report.confidence）。 */
  confidence: number,
): CalibrationNote {
  const labels = calibration.signals.map(
    // 未知のシグナル語彙（将来追加）はスラグのまま出す（隠すより正直に）。
    (s) => SIGNAL_LABELS[s] ?? s,
  );
  const basis =
    labels.length > 0
      ? `裏付け: ${labels.join("・")} ─ 確信度上限 ${pct(calibration.cap)}`
      : `裏付けとなる証拠なし ─ 確信度上限 ${pct(calibration.cap)}`;

  const adjustment =
    confidence < calibration.original
      ? `AI 自己申告 ${pct(calibration.original)} を裏付け上限で ${pct(confidence)} に補正済み`
      : null;

  return { basis, adjustment };
}
