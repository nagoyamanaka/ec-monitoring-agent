import type { DemoStatus } from "../infrastructure/demoApi";

/**
 * デモの現在状態（件数）パネル。backend /demo/status が返す
 * アクティブ alert 数・既知パターン数・自動昇格パターン数を出す。
 * alert 件数は一覧（GET /alerts）と同じ軸（非 RESOLVED）＝リセット直後に
 * 「タイルは 1 なのに一覧は空」の食い違いを起こさない。
 * 学習ループの可視化（フィードバック→昇格でパターンが増える）の即時確認に使う。
 */

export interface SystemStatusProps {
  status: DemoStatus | null;
  loading: boolean;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-slate-800/40 px-2 py-1.5 text-center ring-1 ring-inset ring-slate-700/50">
      <div className="text-lg font-semibold tabular-nums text-slate-50">
        {value}
      </div>
      <div className="text-xs text-slate-300">{label}</div>
    </div>
  );
}

export function SystemStatus({ status, loading }: SystemStatusProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-100">現在の状態</h3>
      {loading && !status ? (
        <div className="h-12 animate-pulse rounded-md bg-slate-800/40" />
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <Stat
            label="アクティブアラート"
            value={status?.activeAlerts ?? "—"}
          />
          <Stat label="パターン" value={status?.patternCount ?? "—"} />
          <Stat label="昇格済み" value={status?.promotedPatternCount ?? "—"} />
        </div>
      )}
    </div>
  );
}
