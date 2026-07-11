import { useEffect, useRef, useState } from "react";

/**
 * アニメーションすべきか（reduced-motion を尊重）。
 * 実ブラウザは必ず matchMedia を持つため、非ブラウザ（jsdom/SSR）では false を返し
 * 即・最終値へ落とす＝getByText 等の同期アサーションが最終値をそのまま読める安全弁を兼ねる。
 * ConfidenceGauge / CalibratedConfidence の prefersReducedMotion と同じ判定思想。
 */
function shouldAnimate(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface UseCountUpOptions {
  /** カウントアップの所要時間（ms）。既定はモーション設計の「距離のある入場」寄り。 */
  durationMs?: number;
}

/**
 * ヒーロー統計向けの数値カウントアップ（L3 モーション設計）。
 * 前回値（初回は 0）から目標値へ ease-out cubic で近づく表示値を返す。
 * ConfidenceGauge のゲージと同一のイージングを共有し、モーションの声を全画面で揃える。
 * reduced-motion / 非ブラウザでは即・目標値（アニメーションなし）。
 *
 * 端数を持つ float を返すため、整数カウンタは呼び出し側で Math.round する。
 */
export function useCountUp(
  target: number,
  { durationMs = 700 }: UseCountUpOptions = {},
): number {
  const [display, setDisplay] = useState(() => (shouldAnimate() ? 0 : target));
  // 直近の到達値。データ更新で target が変わった際、0 からではなく現在地から伸ばす。
  const fromRef = useRef(0);

  useEffect(() => {
    if (!shouldAnimate()) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic（ConfidenceGauge と同一）
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return display;
}
