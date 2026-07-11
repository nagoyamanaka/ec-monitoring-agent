export type EmptyStateFigureVariant = "awaiting" | "disabled";

export interface EmptyStateFigureProps {
  /** awaiting=これから現れる（中空 cyan リング）／disabled=機能オフ（無彩の中空リング）。 */
  variant?: EmptyStateFigureVariant;
  className?: string;
}

/**
 * 空状態・無効状態の抽象図（step9 L5）。ブランドマーク「次の一点」の幾何をそのまま流用する。
 * 観測済みの軌跡（実線）は描けているが、その延長線上にあるはずの「次の一点」がまだ着地して
 * いない＝破線の投影＋中空リングで「これから現れる」を語る。文言だけだった空状態に、世界観
 * （線より先に次の点を知る）を崩さず絵を一枚足す。座標は BrandMark と同一＝幾何の同一性を保つ。
 * cyan は UI 全体と同じく「予測（予兆先手）」の意味にだけ使う＝空状態では中空リング＝未着。
 * track は currentColor 継承（隣接文言の slate に馴染む）。装飾なので aria-hidden。
 */
export function EmptyStateFigure({
  variant = "awaiting",
  className,
}: EmptyStateFigureProps) {
  const awaiting = variant === "awaiting";
  return (
    <svg
      width="60"
      height="60"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* 観測済みの軌跡（BrandMark と同一座標）。空状態なので muted。 */}
      <polyline
        points="14,45 27,45 36,32.4"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.5"
      />
      {/* 次の一点への投影。まだ実現していない＝破線（リング手前で止める）。 */}
      <line
        x1="36"
        y1="32.4"
        x2="42.5"
        y2="23.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="1 5"
        strokeOpacity="0.35"
      />
      {/* 次の一点。未着なので中空リング（awaiting=cyan／disabled=無彩）。 */}
      <circle
        cx="46.5"
        cy="17.5"
        r="5"
        fill="none"
        stroke={awaiting ? "#22d3ee" : "currentColor"}
        strokeWidth="2"
        strokeOpacity={awaiting ? 0.75 : 0.4}
      />
    </svg>
  );
}
