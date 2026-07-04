/**
 * 判定（承認/却下/要確認）の視覚語彙。テキスト記号 ✓/✗/⚠ はフォント依存で描画がばらつき
 * 安っぽく見えるため、stroke ベースの小型 SVG に統一する（heroicons outline 相当の手組み）。
 * 色は親の text 色（currentColor）を継承＝既存の emerald/rose/amber クラスがそのまま効く。
 */

interface IconProps {
  className?: string;
}

const BASE = "h-3.5 w-3.5 shrink-0";

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? BASE}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12.75 11.25 15 15 9.75" />
    </svg>
  );
}

export function XCircleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? BASE}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? BASE}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
