/**
 * 障害シナリオ注入ボタン群。backend が実際に注入できるレシピに対応する。
 * 1〜3（決済タイムアウト/在庫不足/在庫競合）は 押下→EC へ注文投入→業務障害イベント→Alert 化（SSE）が
 * 一覧にライブで流れる＝経路A のデモ。4（インフラ障害）は EC に CRITICAL ログ + HTTP 500 を注入し、
 * GCP の Cloud Monitoring 経由で発報する経路B のデモ（ローカルでは Alert は出ない）。
 * 5（脆弱性検知）は CI(Trivy) の検知を合成し、実在 ingest と同じ変換経路（SecurityScanTranslator→
 * CollectMonitoringEventUseCase）を辿って Alert 化＝DevOps ループ（検知→AI 調査→PR 起票）の起点。
 * いずれも backend に対応経路を持つ合成注入で、エンドポイント不在の偽ボタンは作らない。
 */

export interface ScenarioControlsProps {
  /** 実行中アクション識別子（"scenario:1" 等）。対象ボタンを送信中表示にする。 */
  busy: string | null;
  onTrigger: (id: string) => void;
}

type Scenario = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
};

const SCENARIOS: readonly Scenario[] = [
  {
    id: "1",
    label: "決済タイムアウト",
    description: "決済が時間切れ → 既知パターンに完全一致",
  },
  {
    id: "2",
    label: "在庫不足",
    description: "在庫が足りず予約失敗 → 既知パターン",
  },
  {
    id: "3",
    label: "在庫競合",
    description: "同時注文で在庫が競合 → 未知 → AI 調査",
  },
  {
    id: "4",
    label: "インフラ障害",
    description: "CRITICAL ログ + HTTP 500 → Cloud Monitoring 経由で発報（GCP のみ）",
  },
  {
    id: "5",
    label: "脆弱性検知",
    description: "CI(Trivy) の HIGH/CRITICAL 検知を合成 → AI 調査 → PR 起票（DevOps ループ）",
  },
];

export function ScenarioControls({ busy, onTrigger }: ScenarioControlsProps) {
  const anyBusy = busy !== null;

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        FAULT INJECTION
      </h3>
      <ul className="space-y-1.5">
        {SCENARIOS.map((s) => {
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={anyBusy}
                onClick={() => onTrigger(s.id)}
                title={s.description}
                className="flex w-full items-center justify-between gap-2 rounded-md bg-slate-800/50 px-3 py-2 text-left ring-1 ring-inset ring-slate-700/60 transition hover:bg-slate-700/50 hover:ring-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {s.label}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {s.description}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-cyan-300">
                  {/* {running ? "注入中…" : "実行"} */}
                  {/* 遷移が速すぎてUX悪化してるのでいったんコメントアウト */}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
