import { ReactNode } from "react";
import { Outlet } from "react-router-dom";

export interface DefaultLayoutProps {
  children?: ReactNode;
}

/**
 * /alerts/:id・/analytics 用レイアウト。
 * DemoDrawer は参照しない（デモUIをプロダクション画面に持ち込まない）。
 */
export function DefaultLayout({ children }: DefaultLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-tremor-content-emphasis">
      <header className="sticky top-0 z-10 border-b border-[#232A36] bg-[#0B0E14]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <span className="size-2.5 rounded-full bg-slate-500" />
          <h1 className="text-sm font-semibold tracking-wide text-slate-100">
            EC Monitoring
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">{children ?? <Outlet />}</main>
    </div>
  );
}
