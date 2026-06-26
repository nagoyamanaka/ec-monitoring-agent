/**
 * 障害シナリオ注入ボタン群。backend が実際に注入できる3レシピ（決済タイムアウト/在庫不足/在庫競合）
 * に対応する。押下→EC へ注文投入→障害イベント→Alert 化（SSE）が一覧にライブで流れる＝デモの起点。
 * 証拠パネル（シナリオ4）・リメディエーション（シナリオ5）は注入後の Alert ドロワー内の体験なので
 * ここには独立ボタンを置かない（backend に対応エンドポイントが無い＝偽ボタンを作らない）。
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
    description: "同時注文で在庫が競合 → 既知パターン",
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
