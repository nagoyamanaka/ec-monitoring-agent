/**
 * 予兆デモコンソール（step6 F12）。アラート一覧の DEMO CONSOLE（DemoDrawer/ScenarioControls）
 * と**同一の視覚言語**（fuchsia ピル・slate 行・realness バッジ・cyan 実行/rose リセット）で、
 * 初見の審査員に (1) この予報の材料は何か＝投入シグナルの台帳と本物度、(2) ボタンが何をするか、
 * を1画面で伝える。デモ系 UI はこのパネルに閉じ込め、予報本文（プロダクション面）を侵食しない。
 *
 * realness はアラート側デモ卓と同じ正直さ運用: 合成 seed は「入口のみ合成・突合→AI 予報→
 * 引用検証は実経路」を明示し、実データ（GitHub の実 PR）と区別する。
 */

type SignalRealness = "real" | "seed";

const REALNESS_META: Record<
  SignalRealness,
  { label: string; className: string; note: string }
> = {
  real: {
    label: "実データ",
    className: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
    note: "実 GitHub リポジトリの未マージ PR を read-only で取得する実経路。",
  },
  seed: {
    label: "合成seed",
    className: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    note: "デモ用に投入した合成シグナル（本番では実 plan / 実スケジュール / 実インシデント履歴が同じ入口に入る）。突合 → AI 予報 → 引用検証は実経路・実 AI。",
  },
};

type SignalRow = {
  readonly label: string;
  readonly description: string;
  readonly realness: SignalRealness;
};

const SIGNAL_ROWS: readonly SignalRow[] = [
  {
    label: "未適用の Terraform plan",
    description: "Cloud SQL max_connections 100→40 縮小（apply されると有効）",
    realness: "seed",
  },
  {
    label: "未マージ PR",
    description: "DB 接続プール縮小の draft PR（実リポジトリを read）",
    realness: "real",
  },
  {
    label: "負荷スケジュール",
    description: "土 20:00 週末セール → checkout 負荷 x5",
    realness: "seed",
  },
  {
    label: "過去の解決済み事例",
    description: "同型障害のアーカイブ（実在の Alert として開ける）",
    realness: "seed",
  },
];

export interface ForecastDemoConsoleProps {
  /** 生成済み予報があるか（生成ボタンの文言切替）。 */
  hasBriefing: boolean;
  generating: boolean;
  resetting: boolean;
  /** 直近のデモ操作エラー（文言化済み）。 */
  actionError: string | null;
  onGenerate: () => void;
  onReset: () => void;
}

export function ForecastDemoConsole({
  hasBriefing,
  generating,
  resetting,
  actionError,
  onGenerate,
  onReset,
}: ForecastDemoConsoleProps) {
  const busy = generating || resetting;
  return (
    <section
      aria-label="予兆デモコンソール"
      className="space-y-4 rounded-tremor-default bg-slate-900/40 p-4 ring-1 ring-inset ring-slate-700/60"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30">
          🕹️ デモコンソール
        </span>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-100">
          投入シグナル（予報の材料）
        </h3>
        <p className="text-[11px] leading-relaxed text-slate-400">
          予報はここに並ぶシグナルだけから作られます（バッジ＝入力の本物度）。
        </p>
        <ul className="space-y-1.5">
          {SIGNAL_ROWS.map((row) => {
            const realness = REALNESS_META[row.realness];
            return (
              <li
                key={row.label}
                className="rounded-md bg-slate-800/50 px-3 py-2 ring-1 ring-inset ring-slate-700/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-50">
                    {row.label}
                  </span>
                  <span
                    title={realness.note}
                    className={`shrink-0 cursor-help rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${realness.className}`}
                  >
                    {realness.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-400">
                  {row.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 border-t border-slate-700/50 pt-3">
        <h3 className="text-sm font-semibold text-slate-100">デモ操作</h3>
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          title="上記シグナルを AI（Gemini）が突合し、リスク・確信度・根拠（引用）・今打てる先手を1ショット生成する"
          className="w-full rounded-md bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-inset ring-cyan-500/40 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
        >
          {generating
            ? "AI が突合中…（約1分）"
            : hasBriefing
              ? "▶ 予報を再生成（AI 突合・約1分）"
              : "▶ 予報を生成（AI 突合・約1分）"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReset}
          title="生成済みの予報を破棄して未生成状態に戻す（投入シグナルは残る＝もう一度生成できる）"
          className="w-full rounded-md bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-slate-700/60 transition hover:bg-rose-500/10 hover:text-rose-200 hover:ring-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
        >
          {resetting ? "リセット中…" : "予報をリセット"}
        </button>
        {actionError && (
          <p role="alert" className="text-[11px] text-rose-300">
            {actionError}
          </p>
        )}
      </div>
    </section>
  );
}
