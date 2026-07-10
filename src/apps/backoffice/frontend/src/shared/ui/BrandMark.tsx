export interface BrandMarkProps {
  className?: string;
}

/**
 * プロダクトのブランドマーク（ロゴ）「次の一点」。public/favicon.svg と同一意匠。
 * 実線＝観測済みの軌跡、cyan の点＝その軌道の延長線上にある予測された次のデータポイント。
 * 「線がどこへ向かうかを、線より先に知っている」= Kizashi（兆し）の核をそのまま幾何にした。
 * 旧意匠（グラデタイル＋EKG 脈波）は汎用 activity アイコンと同型で予兆を語れないため改訂。
 * グラデ廃止で useId も不要になった。cyan は UI の「予兆先手」と同じ意味（予測）にだけ使う。
 * 装飾なので aria-hidden（タイトル文字が代替テキストを担う）。
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="#0c1626" />
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="13.5"
        stroke="#94b4d4"
        strokeOpacity="0.25"
      />
      <polyline
        points="14,45 27,45 36,32.4"
        stroke="#e6f4ff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46.5" cy="17.5" r="6" fill="#22d3ee" />
    </svg>
  );
}
