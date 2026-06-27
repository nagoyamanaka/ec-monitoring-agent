import { cn } from "@shared/ui/cn";
import type { PaymentMode } from "../infrastructure/demoApi";

/**
 * EC の決済モード切替（正常／ランダム／タイムアウト）。
 * シナリオ注入が payment/inventory を一括設定するのとは別に、決済の挙動だけを手動で固定したいとき用。
 */

export interface PaymentModeToggleProps {
  mode: PaymentMode;
  /** 実行中アクション識別子（"payment:TIMEOUT" 等）。 */
  busy: string | null;
  onChange: (mode: PaymentMode) => void;
}

const MODES: readonly { value: PaymentMode; label: string }[] = [
  { value: "SUCCESS", label: "正常" },
  { value: "RANDOM", label: "ランダム" },
  { value: "TIMEOUT", label: "タイムアウト" },
];

export function PaymentModeToggle({
  mode,
  busy,
  onChange,
}: PaymentModeToggleProps) {
  const anyBusy = busy !== null;

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        PAYMENT MODE
      </h3>
      <div
        role="group"
        aria-label="PAYMENT MODE"
        className="flex gap-1 rounded-md bg-slate-800/50 p-1 ring-1 ring-inset ring-slate-700/60"
      >
        {MODES.map((m) => {
          const selected = m.value === mode;
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={selected}
              disabled={anyBusy}
              onClick={() => onChange(m.value)}
              className={cn(
                "flex-1 rounded px-2 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40",
                selected
                  ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-inset ring-cyan-500/40"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200",
              )}
            >
              {/* {running ? "CHANGING…" : m.label} */}
              {/* 遷移が速すぎてUX悪化してるのでいったんコメントアウト */}
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
