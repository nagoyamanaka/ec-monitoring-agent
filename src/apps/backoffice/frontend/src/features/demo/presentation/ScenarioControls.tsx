/**
 * 障害シナリオ注入ボタン群。backend が実際に注入できるレシピに対応する。
 *
 * グルーピングは「分類の確度スペクトル」の軸で3群に分ける（＝ポートフォリオ/ハッカソン評価の肝）:
 *
 *  完全一致（既知）… 既知パターンに完全一致。分類と重大度を**即・無料・決定論**で確定（AI 自動起動なし）。
 *      今回の値に合わせた調査レポートが要るときは詳細から「AIレポートを生成」でオンデマンド実行。
 *      同一 dedupKey の重複観測は畳み込み、発生回数だけ加算する。
 *  類似（準・既知）… 完全一致はしないが、過去の解決済み事例に高い字句類似。source=SIMILARITY・
 *      **confidence 付き**で「準・既知」に分類し、AI 生調査を回さず確度を提示する（graded confidence）。
 *  未知障害 … 既知にも類似にも当たらない障害。**ADK マルチエージェント**が起動し、実ログ・実コミット差分を
 *      引用して根本原因分析・影響トリアージ・証拠収集・修正計画まで行う。承認で新しい既知パターンへ昇格。
 *
 * 各行には「入力のリアルさ」バッジ（realness）を付けて正直さを担保する:
 *  実トリガ＝EC へ実注文を流して業務障害イベントを発生 / クラウド実検知＝GCP Cloud Monitoring 経由で発報 /
 *  合成入力＝検知の入口だけ合成（変換→分類→AI 調査→修正提案のパイプラインは実経路）。
 *
 * いずれも backend に対応経路を持ち、エンドポイント不在の偽ボタンは作らない。
 */

export interface ScenarioControlsProps {
  /** 実行中アクション識別子（"scenario:1" 等）。対象ボタンを送信中表示にする。 */
  busy: string | null;
  onTrigger: (id: string) => void;
}

type Realness = "live" | "cloud" | "synthetic";

type Scenario = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly realness: Realness;
};

type ScenarioGroup = {
  readonly title: string;
  /** その群で AI が何をするか（審査員向けの価値説明）。 */
  readonly aiRole: string;
  readonly scenarios: readonly Scenario[];
};

/** リアルさバッジの表示名・配色・ツールチップ。 */
const REALNESS_META: Record<
  Realness,
  { label: string; className: string; note: string }
> = {
  live: {
    label: "実トリガ",
    className: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
    note: "EC へ実際に注文を投入し、業務障害イベントから Alert 化まで実経路で流す。main も外部も汚さない。",
  },
  cloud: {
    label: "クラウド実検知",
    className: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
    note: "GCP に CRITICAL ログ + HTTP 500 を注入し、Cloud Monitoring 経由で発報する実検知経路（GCP デプロイ時のみ）。",
  },
  synthetic: {
    label: "合成入力",
    className: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    note: "障害の入口だけを合成（本番では実 CI／実 apply／実ログが同じ入口に入る）。変換→分類→AI 調査→修正提案のパイプラインはすべて実経路・実 AI。",
  },
};

const SCENARIO_GROUPS: readonly ScenarioGroup[] = [
  {
    title: "完全一致（既知） ― 学習済みパターンで即確定",
    aiRole:
      "既知パターンに完全一致 → 分類・重大度を即・無料・決定論で確定（AI 自動起動なし）。今回の値に合わせた調査レポートが要るときは詳細から『AIレポートを生成』でオンデマンド実行。重複観測は dedup で畳み込み発生回数を加算。",
    scenarios: [
      {
        id: "1",
        label: "決済タイムアウト",
        description: "決済が時間切れ → 既知パターンに完全一致 → 即確定（レポートは必要時オンデマンド生成）",
        realness: "live",
      },
    ],
  },
  {
    title: "類似（準・既知） ― 過去事例に高類似で確度付き分類",
    aiRole:
      "既知パターンには完全一致しないが、正解フィードバックで蓄積した過去の解決済み事例に高い字句類似。source=SIMILARITY・confidence 付きで『準・既知』に分類し、AI 生調査を回さず確度を提示する（graded confidence）。",
    scenarios: [
      {
        id: "2",
        label: "類似障害（準・既知）",
        description:
          "DB コネクションプール枯渇 → 完全一致なし → 過去の解決済み事例に約67%類似 → 準・既知（確度付き）で確定",
        realness: "synthetic",
      },
    ],
  },
  {
    title: "未知障害 ― マルチエージェントが調査",
    aiRole:
      "既知に一致しない障害。ADK マルチエージェント（根本原因分析・影響トリアージ・証拠収集・修正計画）が起動し、実ログ・実コミット差分を引用して調査。承認で新しい既知パターンへ昇格する学習ループ。",
    scenarios: [
      {
        id: "3",
        label: "在庫競合",
        description: "同時注文で在庫が競合 → 未知 → AI 調査 → 承認で新パターン昇格",
        realness: "live",
      },
      {
        id: "4",
        label: "インフラ障害",
        description: "CRITICAL ログ + HTTP 500 → Cloud Monitoring 経由で発報（GCP のみ）",
        realness: "cloud",
      },
      {
        id: "5",
        label: "脆弱性検知",
        description: "CI(Trivy) の HIGH/CRITICAL を合成 → AI 調査 → 修正 PR 起票（DevOps ループ）",
        realness: "synthetic",
      },
      {
        id: "6",
        label: "構成変更障害",
        description: "Cloud SQL 設定縮小（IaC apply）が原因 → AI が terraform 差分を特定",
        realness: "synthetic",
      },
      {
        id: "7",
        label: "アプリコード退行",
        description: "テスト通過のコード変更が挙動退行 → AI が実コミット差分を読んで原因特定",
        realness: "synthetic",
      },
    ],
  },
];

export function ScenarioControls({ busy, onTrigger }: ScenarioControlsProps) {
  const anyBusy = busy !== null;

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        デモシナリオ
      </h3>
      <div className="space-y-3">
        {SCENARIO_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {group.title}
            </h4>
            <p className="text-[10px] leading-relaxed text-slate-500">
              {group.aiRole}
            </p>
            <ul className="space-y-1.5">
              {group.scenarios.map((s) => {
                const realness = REALNESS_META[s.realness];
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
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-slate-100">
                            {s.label}
                          </span>
                          <span
                            title={realness.note}
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset ${realness.className}`}
                          >
                            {realness.label}
                          </span>
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {s.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="rounded-md bg-slate-800/40 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300 ring-1 ring-inset ring-slate-700/50">
        検知は境界の外（実 EC／GCP／CI）で起こる。ここで押すのはその{" "}
        <span className="font-semibold text-emerald-200">実トリガ</span>と、GCP
        なしでも AI 調査を見せるための{" "}
        <span className="font-semibold text-amber-200">合成入力</span>
        （入口だけ合成・パイプラインは実 AI）。既知は即・無料・決定論で確定し、レポートは
        必要時にオンデマンド生成（パターンを文脈に grounding）。類似は確度付きで準・既知に分類し、
        未知は ADK マルチエージェントが実ログ・実コミット差分を引用して調査、承認で知識ベースに昇格する。
      </p>
    </div>
  );
}
