import type { ConfidenceCalibrationView } from "../../domain/InvestigationReportView";
import { calibrationNote } from "../../domain/confidenceCalibration";

/**
 * AI 確信度ゲージ直下の「なぜこの値か」の注記（確信度キャリブレーションの可視化）。
 * backend が記録した裏付けシグナル・上限・自己申告値をそのまま人間の言葉で出す
 * （「証拠0件なのに確信度80%」に見える矛盾への説明責任）。
 */
export function ConfidenceCalibrationNote({
  calibration,
  confidence,
}: {
  calibration: ConfidenceCalibrationView;
  /** 表示中の確信度（＝補正後の report.confidence）。 */
  confidence: number;
}) {
  const note = calibrationNote(calibration, confidence);
  return (
    <div className="max-w-xs text-center">
      <p className="text-xs text-slate-400">{note.basis}</p>
      {note.adjustment && (
        <p className="mt-0.5 text-xs text-slate-400">{note.adjustment}</p>
      )}
    </div>
  );
}
