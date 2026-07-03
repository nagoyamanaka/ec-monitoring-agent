import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "../ui/cn";
import { AppHeader } from "../ui/AppHeader";

export interface AlertsLayoutProps {
  /**
   * デモドロワーの差し込み口。**DemoDrawer を差し込むのは本レイアウトだけ**
   * （DefaultLayout には slot が無い＝プロダクションUI非侵食）。
   * タスク10で features/demo の <DemoDrawer/> をここに渡す。
   */
  demoDrawer?: ReactNode;
  /**
   * グローバルヘッダ右側の差し込み口（SSE ライブ状態など）。
   * shared は features を import できないため slot で受け取る（demoDrawer と同じ流儀）。
   */
  headerSlot?: ReactNode;
  /** Forecast タブの表示可否と HIGH バッジ（AppHeader へ pass-through・F7）。 */
  forecastEnabled?: boolean;
  forecastBadge?: string;
  children?: ReactNode;
}

/** /alerts 専用レイアウト（デモの舞台）。右側にデモドロワーを差し込む。 */
export function AlertsLayout({
  demoDrawer,
  headerSlot,
  forecastEnabled,
  forecastBadge,
  children,
}: AlertsLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-tremor-content-emphasis">
      <AppHeader
        rightSlot={headerSlot}
        forecastEnabled={forecastEnabled}
        forecastBadge={forecastBadge}
      />

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
