import { useEffect, useRef, useState } from "react";
import { cn } from "@shared/ui/cn";
import type { AlertView } from "../../domain/AlertView";
import { alertWorkState } from "../../domain/alertReview";

export interface AlertStatusBadgeProps {
  alert: AlertView;
  className?: string;
}

type Tone = { readonly label: string; readonly cls: string };

/**
 * alert の「対応状態」をひとことで示すバッジ。
 * 分析中 → レビュー待ち → 承認済み/却下済み の遷移を一覧・ドロワーで共通表示し、
 * 「自分が対応すべき行（＝レビュー待ち）」を一目で分かるようにする。
 * 状態算出はヘッダの件数チップと同じ alertWorkState（単一ソース）を使い、
 * バッジと集計が食い違わないことを保証する。
 */
function toneOf(alert: AlertView): Tone {
  switch (alertWorkState(alert)) {
    case "ANALYZING":
      return {
        label: "分析中",
        cls: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
      };
    case "APPROVED":
      return {
        label: "承認済み",
        cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      };
    case "REJECTED":
      return {
        label: "却下済み",
        cls: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
      };
    case "PENDING":
      return {
        label: "レビュー待ち",
        cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
      };
  }
}

export function AlertStatusBadge({ alert, className }: AlertStatusBadgeProps) {
  const state = alertWorkState(alert);
  const { label, cls } = toneOf(alert);
  // 状態が遷移したときだけフェード差し替え（タスク E5: 分析中→レビュー待ち等の
  // 状態変化を「切り替わった」と分かる形で見せる）。初期マウントでは動かさない。
  const prevState = useRef(state);
  const [transitioned, setTransitioned] = useState(false);
  useEffect(() => {
    if (prevState.current !== state) {
      prevState.current = state;
      setTransitioned(true);
    }
  }, [state]);
  return (
    <span
      // 遷移時は key で差し替えてフェードを毎回再生する（同一要素の class 追加だけだと
      // 連続遷移の2回目以降にアニメが再発火しない）。
      key={state}
      onAnimationEnd={() => setTransitioned(false)}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        transitioned && "badge-fade-in",
        cls,
        className,
      )}
    >
      {label}
    </span>
  );
}
