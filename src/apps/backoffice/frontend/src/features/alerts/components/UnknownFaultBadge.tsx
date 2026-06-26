import { cn } from "@shared/ui/cn";

export interface UnknownFaultBadgeProps {
  className?: string;
}

/**
 * 「未知障害」を示すバッジ。既知パターンに該当せず AI が新規障害として調査する種別を、
 * eventName（機械語）だけでは伝わらない“これは未知の障害だ”という第一印象として明示する。
 *
 * 設計判断: tooltip 単独ではなく**可視バッジ**にする。一覧はトリアージ画面で、種別は
 * 隠れたホバーではなく一目で走査できる必要があるため（severity/category/状態と同じバッジ言語に揃える）。
 * 詳しい説明は title 属性で補う。
 */
export function UnknownFaultBadge({ className }: UnknownFaultBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs font-semibold text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30",
        className,
      )}
      title="既知パターンに該当しない新規の障害。AI が証拠を集めて原因を調査します。"
    >
      <span aria-hidden>⚡</span> 未知障害
    </span>
  );
}
