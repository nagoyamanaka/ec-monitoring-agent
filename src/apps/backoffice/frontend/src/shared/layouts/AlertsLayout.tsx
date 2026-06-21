import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "../ui/cn";

export interface AlertsLayoutProps {
  /**
   * デモドロワーの差し込み口。**DemoDrawer を差し込むのは本レイアウトだけ**
   * （DefaultLayout には slot が無い＝プロダクションUI非侵食）。
   * タスク10で features/demo の <DemoDrawer/> をここに渡す。
   */
  demoDrawer?: ReactNode;
  children?: ReactNode;
}

/** /alerts 専用レイアウト（デモの舞台）。右側にデモドロワーを差し込む。 */
export function AlertsLayout({ demoDrawer, children }: AlertsLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-tremor-content-emphasis">
      <header className="sticky top-0 z-10 border-b border-[#232A36] bg-[#0B0E14]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
          <span className="size-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px] shadow-cyan-400/60" />
          <h1 className="text-sm font-semibold tracking-wide text-slate-100">
            EC Monitoring · Alerts
          </h1>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto grid max-w-7xl gap-6 px-6 py-6",
          demoDrawer ? "lg:grid-cols-[1fr_20rem]" : "grid-cols-1",
        )}
      >
        <main className="min-w-0">{children ?? <Outlet />}</main>
        {demoDrawer ? (
          <aside className="lg:sticky lg:top-20 lg:h-fit">{demoDrawer}</aside>
        ) : null}
      </div>
    </div>
  );
}
