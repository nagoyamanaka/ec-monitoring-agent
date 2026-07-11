import { useEffect, useState } from "react";
import { cn } from "@shared/ui/cn";
import { formatDateTimeJa, formatTimeJa } from "@shared/format/dateTime";
import type { StreamStatus } from "../../infrastructure/AlertStream";
import type { LastStreamEvent } from "../hooks/useAlerts";

export interface StreamStatusIndicatorProps {
  status: StreamStatus;
  /** 最後に一覧へ反映が入った時刻。null なら未更新。 */
  lastUpdatedAt: Date | null;
  /**
   * 最後に届いた SSE イベントの種別（タスク E5）。ライブ（open）中に
   * 「アラート受信 たった今」のように一言添え、緑ランプだけでは伝わらない
   * 「何が動いたか」を示す。null なら種別は出さない。
   */
  lastEvent?: LastStreamEvent | null;
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

/**
 * 接続状態 → ランプ色＋ラベル。open=緑（ライブ）/ connecting=琥珀（接続中）/ closed=赤（切断）。
 *
 * 顕著性 Tier1 の規則（L7・全状態要素の正典）: 「状態」（ライブ／接続中／調査中／
 * ストリーミング／検知待ち）だけは彩色文字＋パルスで光る権利を持つ＝Tier1。L0 で分類タグ・
 * メタ・生ID を slate に沈めた後も、状態が光るのは"例外"でなく"規則"（システムが今どこで
 * 何を観測しているかは、静かな管制室で唯一動いて良い情報）。色相は意味のまま（緑=生きている／
 * 琥珀=確立待ち／赤=切断・要復帰／cyan=AI が仕事中）＝L0 の「色相=意味・輝度=階層」に整合。
 */
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
  return formatTimeJa(from);
}

/**
 * SSE のライブ状態を一覧ヘッダ右側に出すインジケータ。
 * 接続中は緑ランプ（パルス）で「通信が生きている」ことを示す。
 * ライブ（open）中は「いつ反映されたか」は自明なので最終更新は隠し、代わりに
 * 最後に届いたイベント種別を一言添える（「アラート受信 たった今」。タスク E5）。
 * 非ライブ（接続中/切断）かつ更新済みのときだけ最終更新を出し、相対時刻を10秒ごとに再計算する。
 */
export function StreamStatusIndicator({
  status,
  lastUpdatedAt,
  lastEvent = null,
  onReconnect,
  className,
}: StreamStatusIndicatorProps) {
  const tone = TONE[status];
  const [now, setNow] = useState(() => Date.now());

  // 最終更新（相対時刻）を実際に出すのは「非ライブ かつ 更新済み」のときだけ。
  const showLastUpdated = status !== "open" && lastUpdatedAt !== null;
  // イベント種別はライブ中のみ（非ライブでは受信が止まっており誤解を招く）。
  const showLastEvent = status === "open" && lastEvent !== null;

  // 「X秒前」を生かすため軽く再描画する（リスト本体は別 state なので影響しない）。
  // 相対時刻を表示しているときだけ動かす。
  useEffect(() => {
    if (!showLastUpdated && !showLastEvent) return;
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [showLastUpdated, showLastEvent]);

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
      {showLastEvent && lastEvent && (
        <span
          className="text-slate-400"
          title={formatDateTimeJa(lastEvent.at)}
        >
          {lastEvent.label} {formatRelative(lastEvent.at, now)}
        </span>
      )}
      {showLastUpdated && lastUpdatedAt && (
        <span
          className="text-slate-400"
          title={formatDateTimeJa(lastUpdatedAt)}
        >
          最終更新 {formatRelative(lastUpdatedAt, now)}
        </span>
      )}
      {status === "closed" && onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-600 transition hover:bg-slate-700/60 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95"
        >
          再接続
        </button>
      )}
    </div>
  );
}
