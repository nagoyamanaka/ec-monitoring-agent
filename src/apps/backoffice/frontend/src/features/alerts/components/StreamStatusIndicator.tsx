import { useEffect, useState } from "react";
import { cn } from "@shared/ui/cn";
import type { StreamStatus } from "../infrastructure/AlertStream";

export interface StreamStatusIndicatorProps {
  status: StreamStatus;
  /** 最後に一覧へ反映が入った時刻。null なら未更新。 */
  lastUpdatedAt: Date | null;
  /**
   * 切断状態（closed）で表示する「再接続」ボタンのハンドラ。
   * 渡さない場合はボタンを出さない（ページ側で stream.reconnect を持つかどうかを選択できる）。
   */
  onReconnect?: () => void;
  className?: string;
}

type Tone = {
  readonly label: string;
  readonly dot: string;
  readonly text: string;
  readonly pulse: boolean;
};

/** 接続状態 → ランプ色＋ラベル。open=緑（ライブ）/ connecting=琥珀（接続中）/ closed=赤（切断）。 */
const TONE: Record<StreamStatus, Tone> = {
  open: {
    label: "ライブ",
    dot: "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60",
    text: "text-emerald-300",
    pulse: true,
  },
  connecting: {
    label: "接続中…",
    dot: "bg-amber-400 shadow-[0_0_8px] shadow-amber-400/60",
    text: "text-amber-300",
    pulse: true,
  },
  closed: {
    label: "切断",
    dot: "bg-rose-500",
    text: "text-rose-300",
    pulse: false,
  },
};

function formatRelative(from: Date, now: number): string {
  const sec = Math.max(0, Math.round((now - from.getTime()) / 1000));
  if (sec < 5) return "たった今";
  if (sec < 60) return `${sec}秒前`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分前`;
  return from.toLocaleTimeString();
}

/**
 * SSE のライブ状態を一覧ヘッダ右側に出すインジケータ。
 * 接続中は緑ランプ（パルス）で「通信が生きている」ことを示す。
 * ライブ（open）中は「いつ反映されたか」は自明なので最終更新は隠し、緑ランプのみ。
 * 非ライブ（接続中/切断）かつ更新済みのときだけ最終更新を出し、相対時刻を10秒ごとに再計算する。
 */
export function StreamStatusIndicator({
  status,
  lastUpdatedAt,
  onReconnect,
  className,
}: StreamStatusIndicatorProps) {
  const tone = TONE[status];
  const [now, setNow] = useState(() => Date.now());

  // 最終更新（相対時刻）を実際に出すのは「非ライブ かつ 更新済み」のときだけ。
  const showLastUpdated = status !== "open" && lastUpdatedAt !== null;

  // 「X秒前」を生かすため軽く再描画する（リスト本体は別 state なので影響しない）。
  // 相対時刻を表示しているときだけ動かす。
  useEffect(() => {
    if (!showLastUpdated) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [showLastUpdated]);

  return (
    <div
      className={cn("flex items-center gap-2 text-xs", className)}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            tone.dot,
            tone.pulse && "animate-pulse",
          )}
          aria-hidden
        />
        <span className={cn("font-medium", tone.text)}>{tone.label}</span>
      </span>
      {showLastUpdated && lastUpdatedAt && (
        <span className="text-slate-400" title={lastUpdatedAt.toLocaleString()}>
          最終更新 {formatRelative(lastUpdatedAt, now)}
        </span>
      )}
      {status === "closed" && onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-600 transition hover:bg-slate-700/60 hover:text-slate-200 active:scale-95"
        >
          再接続
        </button>
      )}
    </div>
  );
}
