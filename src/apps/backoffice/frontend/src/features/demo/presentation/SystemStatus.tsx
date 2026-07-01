import type { DemoStatus } from "../infrastructure/demoApi";

/**
 * デモの現在状態（件数）パネル。backend /demo/status が返す
 * alert 総数・既知パターン数・自動昇格パターン数を出す。
 * 学習ループの可視化（フィードバック→昇格でパターンが増える）の即時確認に使う。
 */

export interface SystemStatusProps {
  status: DemoStatus | null;
  loading: boolean;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-800/40 px-2 py-1.5 text-center ring-1 ring-inset ring-slate-700/50">
      <div className="text-base font-semibold tabular-nums text-slate-100">
        {value}
      </div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

export function SystemStatus({ status, loading }: SystemStatusProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        現在の状態
      </h3>
      {loading && !status ? (
        <div className="h-12 animate-pulse rounded-md bg-slate-800/40" />
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="アラート" value={status?.totalAlerts ?? "—"} />
          <Stat label="パターン" value={status?.patternCount ?? "—"} />
          <Stat label="昇格済み" value={status?.promotedPatternCount ?? "—"} />
        </div>
      )}
    </div>
  );
}
