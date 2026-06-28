import type { DemoApi } from "../infrastructure/demoApi";
import { useDemoControls } from "./hooks/useDemoControls";
import { SystemStatus } from "./SystemStatus";
import { ScenarioControls } from "./ScenarioControls";

export interface DemoDrawerProps {
  api: DemoApi;
  /** reset 完了後に呼ばれるコールバック。アラート一覧の全件再取得に使う。 */
  onAfterReset?: () => void;
}

/**
 * デモ操作ドロワー（タスク10）。AlertsLayout の右 aside にだけ差し込み、プロダクション UI を侵食しない。
 * DEMO_ENABLED=false の本番では /demo/status が 404 → available=false で**何も描画しない**。
 * シナリオ注入→一覧に SSE で障害が流れる、という「デモの舞台裏の操作卓」。
 */
export function DemoDrawer({ api, onAfterReset }: DemoDrawerProps) {
  const {
    available,
    loading,
    status,
    error,
    busy,
    triggerScenario,
    reset,
  } = useDemoControls(api, { onAfterReset });

  // デモ無効（本番）なら丸ごと出さない。
  if (!available) return null;

  return (
    <section
      aria-label="DEMO CONSOLE"
      className="space-y-4 rounded-tremor-default bg-slate-900/40 p-4 ring-1 ring-inset ring-slate-700/60"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30">
          🕹️ DEMO CONSOLE
        </span>
      </div>

      <SystemStatus status={status} loading={loading} />
      <ScenarioControls busy={busy} onTrigger={triggerScenario} />

      <div className="space-y-2 border-t border-slate-700/50 pt-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => reset()}
          title="アラート・既知パターンを seed 初期状態に戻す"
          className="w-full rounded-md bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-slate-700/60 transition hover:bg-rose-500/10 hover:text-rose-200 hover:ring-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
        >
          {/* {busy === "reset" ? "INITIALIZING…" : "INITIALIZE DEMO"}  */}
          {/* 遷移が速すぎてUX悪化してるのでいったんコメントアウト */}
          INITIALIZE DEMO
        </button>
        {error && (
          <p className="text-[11px] text-rose-300">
            操作に失敗しました。{error.message}
          </p>
        )}
      </div>
    </section>
  );
}
