import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "../ui/AppHeader";

export interface DefaultLayoutProps {
  /**
   * グローバルヘッダ右側の差し込み口（SSE ライブ状態など）。
   * AlertsLayout と同じ流儀で slot 受け（shared は features を import できないため）。
   */
  headerSlot?: ReactNode;
  children?: ReactNode;
}

/**
 * /alerts/:id・/analytics 用レイアウト。
 * DemoDrawer は参照しない（デモUIをプロダクション画面に持ち込まない）。
 * ヘッダは AlertsLayout と共通の AppHeader（ナビタブ）に統一する。
 */
export function DefaultLayout({ headerSlot, children }: DefaultLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-tremor-content-emphasis">
      <AppHeader rightSlot={headerSlot} />
      <main className="mx-auto max-w-5xl px-6 py-6">{children ?? <Outlet />}</main>
    </div>
  );
}
