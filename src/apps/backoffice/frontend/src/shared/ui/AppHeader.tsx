import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { cn } from "./cn";

export interface AppHeaderProps {
  /** ヘッダー右側の差し込み口（SSE ライブ状態など。features は import できないため slot 受け）。 */
  rightSlot?: ReactNode;
  /** Forecast タブを出すか。既定 off＝backend の FORECAST_ENABLED に追従（GET /forecast の可用性で判定）。 */
  forecastEnabled?: boolean;
  /**
   * Forecast タブに添える HIGH リスクバッジ（例: "HIGH 1件"）。予兆への導線1個だけ（F7）＝
   * 一覧へ予報コンテンツは混載しない方針のまま、リスクの存在だけをナビで知らせる。
   */
  forecastBadge?: string;
}

// ナビは日本語主ラベル＋英語サブラベル（E3）: ページ見出しが日本語
// （アラート一覧/学習の軌跡/予兆ブリーフィング）のため、クリック前後で語が接続するよう
// 主語彙を日本語に揃える。英字は Kizashi AI-SRE ブランドと共存する小さな添えに降格。
const BASE_NAV: ReadonlyArray<{ to: string; label: string; sub: string }> = [
  { to: "/alerts", label: "アラート", sub: "Alerts" },
  // サブラベルは主ラベル「学習」の英訳＝Learning。旧 Analytics は集計ダッシュボード
  // 時代の名残で、U5 で主役を「学習の軌跡」に据えた現状の実態（集計は details 従属）と
  // 語が接続しない。URL /analytics と API GET /analytics は据え置き（表示語彙のみ変更）。
  { to: "/analytics", label: "学習", sub: "Learning" },
];

/**
 * 全画面共通のグローバルヘッダー（ブランド＋ナビタブ＋右スロット）。
 * 観測コンソールの定石どおり上タブで アラート / 学習（/ 予兆）を切替える。
 * shared に置き features を import しないため、ライブ状態などは rightSlot で受け取る。
 * NavLink の active を cyan ピルで示し、/alerts/:id 詳細でも「アラート」を点灯させる（end 指定なし）。
 */
export function AppHeader({
  rightSlot,
  forecastEnabled = false,
  forecastBadge,
}: AppHeaderProps) {
  const items = forecastEnabled
    ? [...BASE_NAV, { to: "/forecast", label: "予兆", sub: "Forecast" }]
    : BASE_NAV;

  return (
    <header className="sticky top-0 z-20 border-b border-[#232A36] bg-[#0B0E14]/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <BrandMark />
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-wide text-slate-100">
              Kizashi
            </span>
            <span className="text-[10px] font-medium tracking-wider text-teal-400">
              AI-SRE
            </span>
          </span>
        </div>
        <nav className="flex items-center gap-1" aria-label="主ナビゲーション">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/30"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-200",
                )
              }
            >
              {it.label}
              {/* 英語サブラベルは accessible name にも含める（テスト/読み上げが
                  従来の英語名 Alerts/Analytics/Forecast でも到達できる互換）。 */}
              <span className="ml-1 text-[10px] font-normal tracking-wide opacity-60">
                {it.sub}
              </span>
              {it.to === "/forecast" && forecastBadge && (
                <span className="ml-1.5 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 ring-1 ring-inset ring-rose-500/30">
                  {forecastBadge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </div>
    </header>
  );
}
