import type { SVGProps } from "react";

/**
 * 撮影ホスト・審査員ブラウザで絵文字が □（U+FFFD 豆腐）に化けるのを避けるための、
 * 依存追加ゼロの inline SVG アイコン群（step7 A1）。lucide-react は入れず、動画に映る
 * 主役の絵文字だけ手書きで置換する。全アイコンは `currentColor` 継承・`aria-hidden`。
 * サイズは 1em 基準（周囲テキストに追従）。装飾用途のみなのでラベルは持たせない。
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...props}
    >
      {children}
    </svg>
  );
}

/** 先手カード見出し（🛡 の置換）。 */
export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  );
}

/** 予報ウィンドウ見出し（⏱ の置換）。 */
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Icon>
  );
}

/** 証拠リンクチップ・リンクコピー（🔗 の置換）。 */
export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5" />
    </Icon>
  );
}

/** デモコンソールバッジ（🕹️ の置換）。 */
export function GamepadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59c-.06.6-.15 1.34-.24 2.09C2.12 14.24 2 16 2 16a3 3 0 0 0 5.4 1.8l.6-.8a2 2 0 0 1 1.6-.8h4.8a2 2 0 0 1 1.6.8l.6.8A3 3 0 0 0 22 16s-.12-1.76-.46-5.32c-.09-.75-.18-1.49-.24-2.09A4 4 0 0 0 17.32 5z" />
    </Icon>
  );
}
