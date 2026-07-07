/**
 * 予兆デモコンソール（step6 F12）。アラート一覧の DEMO CONSOLE（DemoDrawer/ScenarioControls）
 * と**同一の視覚言語**（fuchsia ピル・slate 行・realness バッジ・cyan 実行/rose リセット）で、
 * 初見の審査員に (1) この予報の材料は何か＝投入シグナルの台帳と本物度、(2) ボタンが何をするか、
 * を1画面で伝える。デモ系 UI はこのパネルに閉じ込め、予報本文（プロダクション面）を侵食しない。
 *
 * 台帳は**材料の分類**を語る（AI の評価結果ではない）: 予報カードの引用レーンと同じ3系統・
 * 同じ色（未来の変更=cyan / スケジュール=amber / 過去の同型事例=emerald）でグルーピングし、
 * 「材料の3系統 → 根拠 n系統チップ → 引用レーン」が同一の視覚語彙で一本につながるようにする。
 *
 * realness はアラート側デモ卓と同じ正直さ運用: 合成 seed は「入口のみ合成・突合→AI 予報→
 * 引用検証は実経路」を明示し、実データ（GitHub の実 PR）と区別する。未マージ PR は実リポジトリの
 * open PR を**全件** read するため、台帳に無い PR が予報に現れても嘘にならない文言にしている。
 */
import { GamepadIcon } from "@shared/ui/icons";

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

/** 材料の1系統（引用レーンと同じ分類・同じ色）。 */
type SignalLane = {
  /** 引用レーンと同一のラベル（CitationList の KIND_LABELS と揃える）。 */
  readonly kindLabel: string;
  /** この系統が予報に与える役割（初見向けの一言）。 */
  readonly role: string;
  /** レーン左ボーダー（CitationList の LANE_BORDERS と同色）。 */
  readonly border: string;
  /** 系統チップの塗り（CitationList の KIND_TONES と同色）。 */
  readonly chipClassName: string;
  readonly rows: readonly SignalRow[];
};

const SIGNAL_LANES: readonly SignalLane[] = [
  {
    kindLabel: "未来の変更",
    role: "何が変わる予定か",
    border: "border-cyan-500/40",
    chipClassName:
      "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
    rows: [
      {
        label: "未適用の Terraform plan",
        description:
          "バックボーンVM（Mongo 同居）を e2-standard-2 → e2-small に縮小（apply されると有効・実 PR の plan と同内容）",
        realness: "seed",
      },
      {
        label: "未マージ PR",
        description:
          "実リポジトリの open PR を全件 read（VM 縮小・プール縮小の draft PR ほか）",
        realness: "real",
      },
    ],
  },
  {
    kindLabel: "スケジュール",
    role: "いつ負荷が来るか",
    border: "border-amber-500/40",
    chipClassName:
      "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    rows: [
      {
        label: "負荷スケジュール",
        description: "土 20:00 週末セール → checkout 負荷 x5",
        realness: "seed",
      },
    ],
  },
  {
    kindLabel: "過去の同型事例",
    role: "過去に何が起きたか",
    border: "border-emerald-500/40",
    chipClassName:
      "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    rows: [
      {
        label: "過去の解決済み事例",
        description:
          "前回の VM 縮小で枯渇した事例ほか同型障害のアーカイブ（実在の Alert として開ける）",
        realness: "seed",
      },
    ],
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
        <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30">
          <GamepadIcon className="shrink-0" />
          デモコンソール
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-100">
          投入シグナル（予報の材料）
        </h3>
        <p className="text-[11px] leading-relaxed text-slate-400">
          予報はこの3系統の突合だけから作られます（色＝予報カードの引用レーン、バッジ＝入力の本物度）。
        </p>
        <div className="space-y-2.5">
          {SIGNAL_LANES.map((lane) => (
            <div
              key={lane.kindLabel}
              className={`space-y-1.5 border-l-2 pl-2.5 ${lane.border}`}
            >
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${lane.chipClassName}`}
                >
                  {lane.kindLabel}
                </span>
                <span className="text-[11px] text-slate-400">{lane.role}</span>
              </div>
              <ul className="space-y-1.5">
                {lane.rows.map((row) => {
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
          ))}
        </div>
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
        {/* 結果が出る場所を指し示す（視線誘導）。押下はここだが、進行状況と着地は本文側。 */}
        {generating && (
          <p className="text-[11px] text-cyan-200/80">
            進行状況は予報本文の側に表示しています。完成すると予報カードに置き換わります。
          </p>
        )}
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
