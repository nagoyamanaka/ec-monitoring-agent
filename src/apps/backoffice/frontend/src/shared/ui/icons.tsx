import type { ComponentType, SVGProps } from "react";

/**
 * 撮影ホスト・審査員ブラウザで絵文字が □（U+FFFD 豆腐）に化けるのを避けるための、
 * 依存追加ゼロの inline SVG アイコン群（step7 A1）。lucide-react は入れず、動画に映る
 * 主役の絵文字だけ手書きで置換する。全アイコンは `currentColor` 継承・`aria-hidden`。
 * サイズは 1em 基準（周囲テキストに追従）。装飾用途のみなのでラベルは持たせない。
 *
 * step9 L1: アイコン代用のテキストグリフ（⏱◈🛡🖥️📈⬡❮❯⚡⚖ と装飾の ▶▼↗›）も
 * 環境依存の描画差が拡大静止画で見えるため、全て本ファイルの SVG へ置換した。
 * 文中インライン利用は `inline-block align-[-0.125em]` を className で渡す。
 */
type IconProps = SVGProps<SVGSVGElement>;

/** アイコン対応表（種別キー → SVG）を組む側が使うコンポーネント型。 */
export type IconComponent = ComponentType<IconProps>;

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

/** Cloud Monitoring・メトリクス証拠源（📈 の置換）。 */
export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 5-6" />
    </Icon>
  );
}

/** Terraform 証拠源（⬡ の置換）。 */
export function HexagonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </Icon>
  );
}

/** GitHub コミット・コード証拠源（❮❯ の置換）。 */
export function CodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m8 6-6 6 6 6" />
      <path d="m16 6 6 6-6 6" />
    </Icon>
  );
}

/** Cloud Logging・ログ証拠源（▤ の置換）。 */
export function LogLinesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M3 14.5h18" />
    </Icon>
  );
}

/** 類似事例DB 証拠源（◎ の置換）。 */
export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </Icon>
  );
}

/** 手順書・体制マスタ（📘 の置換）。 */
export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  );
}

/** Cloud Console リンク（🖥️ の置換）。 */
export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </Icon>
  );
}

/** ログ深リンク（📄 の置換）。 */
export function FileTextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </Icon>
  );
}

/** コード修正リンク（🔧 の置換）。 */
export function WrenchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Icon>
  );
}

/** 既知パターン一致＝即・無料の速さ（⚡ の置換）。 */
export function ZapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </Icon>
  );
}

/** 確定条件のしきい値ゲート（⚖ の置換）。 */
export function ScaleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </Icon>
  );
}

/** 結晶化パターン＝承認により学習（◈ の置換）。中心の菱形は塗りで ◈ の字形を踏襲する。 */
export function DiamondIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l9 9-9 9-9-9z" />
      <path d="M12 9.5 14.5 12 12 14.5 9.5 12z" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** フロー図の流れ・委譲（▶（流れ）/⇢ の置換）。 */
export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

/** フロー図の流れ・昇格（モバイル縦積みの ▼ の置換）。 */
export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Icon>
  );
}

/** 外部リンクの行き先表示（↗ の置換）。 */
export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </Icon>
  );
}

/** クリック誘導・開閉トグル（›/▶（開閉）/▸ の置換。開時は rotate-90 を渡す）。 */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

/** 実行ボタンの再生記号（ボタン文言先頭の ▶ の置換）。塗りで「押すと動く」を語る。 */
export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </Icon>
  );
}

/** 未登録ツールのフォールバック点（· の置換）。 */
export function DotIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
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
