import { useId } from "react";

export interface BrandMarkProps {
  className?: string;
}

/**
 * プロダクトのブランドマーク（ロゴ）。
 * 旧ロゴは cyan の丸ドットで SSE のライブ状態ランプと紛らわしかったため、
 * 角丸スクエア＋cyan→blue グラデの中に監視らしい「脈波（EKG/ウェーブ）」線を置いた
 * 明確なロゴ形にした。装飾なので aria-hidden（タイトル文字が代替テキストを担う）。
 * linearGradient の id は useId() で一意化し、同一ページに複数配置しても衝突しない。
 */
export function BrandMark({ className }: BrandMarkProps) {
  const uid = useId();
  const gradientId = `brandmark-gradient-${uid}`;

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="20" y2="20">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="20" height="20" rx="5" fill={`url(#${gradientId})`} />
      <polyline
        points="3,11 6.5,11 8.5,6 11.5,14 13.5,11 17,11"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
