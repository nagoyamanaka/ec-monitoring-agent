import { useEffect, useState } from "react";
import { cn } from "@shared/ui/cn";
import type { ConfidenceCalibrationView } from "../../domain/InvestigationReportView";
import { calibrationNote } from "../../domain/confidenceCalibration";

/**
 * 確信度キャリブレーションの署名的UI（タスク C-4）。
 * 「AI 自己申告 90% → 裏付け上限で 40% に補正」というプロダクト最大の差別化を、
 * 言葉を読まなくても伝わる横バーで示す: マウント時に自己申告幅の斜線ゴーストが描かれ、
 * 600ms かけて補正後の実バー（cyan・E4 の確信度トーン統一）へ「削られる」。
 * 自己申告位置にはゴーストマーカーを残す。数字・文言は全て backend が記録した事実
 * （ConfidenceCalibrationView）と既存の calibrationNote 純関数から導出＝盛る経路が無い。
 * reduced-motion 環境ではアニメせず最終状態を即時表示する。
 */
export interface CalibratedConfidenceProps {
  calibration: ConfidenceCalibrationView;
  /** 表示中の確信度（＝補正後の report.confidence）。 */
  confidence: number;
  className?: string;
}

/** reduced-motion を尊重するか（jsdom で matchMedia 未実装でも安全に false 判定）。 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** 自己申告ゴーストの斜線パターン（「上限で切り詰めた分」＝実体の無い自己申告を示す）。 */
const GHOST_STRIPES =
  "repeating-linear-gradient(135deg, rgba(148,163,184,0.35) 0 4px, transparent 4px 8px)";

const CAP_TOOLTIP =
  "引用照合済みの裏付けシグナル（既知パターン一致・原因コミット引用・Terraform 変更など）の強さに応じて確信度の上限を決め、AI の自己申告を上限で切り詰めています";

export function CalibratedConfidence({
  calibration,
  confidence,
  className,
}: CalibratedConfidenceProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  const original = Math.min(1, Math.max(0, calibration.original));
  const truncated = clamped < original;
  const note = calibrationNote(calibration, clamped);

  // 実バーの表示幅: アニメ時は自己申告幅から始めて補正後へ縮める（削られる演出）。
  const [settled, setSettled] = useState(!truncated || prefersReducedMotion());
  useEffect(() => {
    if (settled) return;
    // 初回ペイントで自己申告幅を確実に描いてから縮める（rAF 2 段で transition を発火させる）。
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [settled]);

  const barPercent = (settled ? clamped : original) * 100;

  return (
    <div className={cn("w-full max-w-xs space-y-1", className)}>
      {/* 視覚部はテキスト行（basis/adjustment）が全情報を運ぶため装飾扱いにする。 */}
      <div
        aria-hidden
        className="relative h-2.5 w-full rounded-full bg-slate-700/40"
      >
        {/* 自己申告ゴースト（斜線・静止）: 「AI はここまで自信があると言った」の痕跡。 */}
        {truncated && (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${original * 100}%`,
              backgroundImage: GHOST_STRIPES,
            }}
          />
        )}
        {/* 補正後の実バー（cyan）: 自己申告幅 → 補正後幅へ 600ms で削られる。 */}
        <div
          data-testid="calibrated-bar"
          className="absolute inset-y-0 left-0 rounded-full bg-cyan-400/90 transition-[width] duration-[600ms] ease-out motion-reduce:transition-none"
          style={{ width: `${barPercent}%` }}
        />
        {/* 自己申告位置のゴーストマーカー。 */}
        {truncated && (
          <div
            className="absolute -inset-y-0.5 w-px bg-slate-300/70"
            style={{ left: `${original * 100}%` }}
          />
        )}
      </div>
      {note.adjustment && (
        <p
          className="cursor-help text-xs text-slate-300"
          title={CAP_TOOLTIP}
        >
          {note.adjustment}
        </p>
      )}
      <p className="text-xs text-slate-400">{note.basis}</p>
    </div>
  );
}
