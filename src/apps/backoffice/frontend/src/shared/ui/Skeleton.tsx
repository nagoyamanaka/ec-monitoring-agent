import { cn } from "./cn";

/**
 * ローディング骨格の共通プリミティブ群（L8）。
 *
 * 方針: のっぺりした灰色ブロックではなく「到着するレイアウトのシルエット」を象る。
 * 骨格は装飾なので aria-hidden とし、読み上げ用の状態（aria-busy / role=status）は
 * 呼び出し側のコンテナが持つ（AlertList など既存の実装に合わせる）。
 *
 * reduced-motion では脈動を止める（既存の motion-reduce 規約と整合）。
 */

/** 骨格の1本のバー/ブロック。幅・高さ・角丸は呼び出し側で上書きする。 */
export function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse bg-slate-700/40 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/**
 * リスク/ブリーフィングカードのシルエット。
 * 見出し帯 → サブテキスト → 到着するミニフロー帯（段が横に連なる）を象る。
 * AnalyticsPage（学習の軌跡ヒーロー）と ForecastPage（予兆ブリーフィング）で共用。
 */
export function RiskCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "space-y-4 rounded-tremor-default bg-slate-800/40 p-4",
        className,
      )}
    >
      {/* 見出し＋サブテキスト */}
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-32 rounded" />
        <SkeletonBar className="h-2.5 w-3/4 rounded" />
      </div>
      {/* 到着するミニフロー帯: 段 → コネクタ → 段 → コネクタ → 段 */}
      <div className="flex items-stretch gap-2">
        <SkeletonBar className="h-20 flex-1 rounded-lg" />
        <SkeletonBar className="h-20 w-6 self-center rounded" />
        <SkeletonBar className="h-20 flex-1 rounded-lg" />
        <SkeletonBar className="h-20 w-6 self-center rounded" />
        <SkeletonBar className="h-20 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * アラート1行のシルエット: 左の severity ストライプ ＋ 中央のテキスト行 ＋ 右の確信度レール。
 * AlertList のローディングで縦に並べる。
 */
export function AlertRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-stretch gap-3 overflow-hidden rounded-tremor-default bg-slate-800/40 p-4",
        className,
      )}
    >
      {/* 左: severity ストライプ */}
      <SkeletonBar className="w-1 shrink-0 rounded-full" />
      {/* 中央: タイトル → 原因1行 → メタ */}
      <div className="flex-1 space-y-2 py-0.5">
        <SkeletonBar className="h-3 w-1/2 rounded" />
        <SkeletonBar className="h-2.5 w-3/4 rounded" />
        <SkeletonBar className="h-2.5 w-1/3 rounded" />
      </div>
      {/* 右: 確信度レール */}
      <div className="flex w-16 shrink-0 flex-col items-end justify-between py-0.5">
        <SkeletonBar className="h-2.5 w-10 rounded" />
        <SkeletonBar className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

/**
 * アラート詳細のシルエット: ヘッダ（severity バッジ ＋ カテゴリチップ）＋ 本文行。
 * AlertDetailPage のローディングで使う。
 */
export function AlertDetailSkeleton({ className }: { className?: string }) {
  return (
    <article aria-hidden className={cn("space-y-6", className)}>
      {/* ヘッダ: バッジ＋チップ＋タイトル */}
      <div className="space-y-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-5 w-16 rounded-md" />
          <SkeletonBar className="h-5 w-20 rounded-md" />
        </div>
        <SkeletonBar className="h-4 w-2/3 rounded" />
      </div>
      {/* 本文行 */}
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-full rounded" />
        <SkeletonBar className="h-3 w-5/6 rounded" />
        <SkeletonBar className="h-3 w-4/6 rounded" />
      </div>
    </article>
  );
}

/**
 * 小さな1行ステータスのシルエット（リメディエーション状態など）。
 * ラベル片 ＋ 短いバーで、到着する状態行を象る。
 */
export function StatusLineSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center gap-2 rounded-md bg-slate-800/40 px-3 py-3",
        className,
      )}
    >
      <SkeletonBar className="h-2 w-2 rounded-full" />
      <SkeletonBar className="h-2.5 w-40 rounded" />
    </div>
  );
}
