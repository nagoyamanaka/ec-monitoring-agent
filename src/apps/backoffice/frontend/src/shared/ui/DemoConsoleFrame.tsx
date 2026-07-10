import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * デモコンソールの外枠（タスク B-2）。アラート側（DemoDrawer）と予兆側
 * （ForecastDemoConsole）が共有し、「本製品とは別物＝演出の操作卓」を一目で伝える:
 * 破線ボーダー＋角の斜めストライプ DEMO タグ＋fuchsia の薄いトーン。
 * 色以外の手掛かり（破線・タグ）を持つため、グレースケールでも本番 UI と境界が判別できる。
 */
export interface DemoConsoleFrameProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

/** DEMO タグの斜めストライプ（fuchsia/暗部の交互）。 */
const DEMO_STRIPES =
  "repeating-linear-gradient(135deg, rgba(217,70,239,0.35) 0 4px, transparent 4px 8px)";

export function DemoConsoleFrame({
  ariaLabel,
  children,
  className,
}: DemoConsoleFrameProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "relative space-y-4 rounded-tremor-default border-[1.5px] border-dashed border-fuchsia-400/40 bg-fuchsia-950/20 p-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute -top-2 right-4 rounded-sm bg-slate-900 px-1.5 py-px text-[9px] font-semibold tracking-[0.25em] text-fuchsia-300 ring-1 ring-fuchsia-400/50"
        style={{ backgroundImage: DEMO_STRIPES }}
      >
        DEMO
      </span>
      {children}
    </section>
  );
}
