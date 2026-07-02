import { useState } from "react";

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
 *
 * **UX 方針（アクション優先＋シナリオ単位の段階開示）**: 休止状態は「押せる行＋確度スペクトルの短いチップ」
 * だけ。行をクリックすると**その場でパネルが開き**、説明・その群で AI がすること・realness 凡例・
 * トリガーボタンをまとめて出す。物語（＝評価の肝）は各シナリオの文脈に紐付いた状態で、必要時にだけ現れる。
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
  /** 休止時に出す短いチップ見出し（確度スペクトルの一言）。 */
  readonly chip: string;
  /** その群で AI が何をするか（審査員向けの価値説明）。展開パネルにのみ出す。 */
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
    chip: "既知 ・ 即確定",
    aiRole:
      "既知パターンに完全一致 → 分類・重大度を即・無料・決定論で確定（AI 自動起動なし）。今回の値に合わせた調査レポートが要るときは詳細から『AIレポートを生成』でオンデマンド実行。重複観測は dedup で畳み込み発生回数を加算。",
    scenarios: [
      {
        id: "1",
        label: "決済タイムアウト",
        description:
          "決済が時間切れ → 既知パターンに完全一致 → 即確定（レポートは必要時オンデマンド生成）",
        realness: "live",
      },
    ],
  },
  {
    chip: "類似 ・ 即確定（確度付き）",
    aiRole:
      "既知パターンには完全一致しないが、正解フィードバックで蓄積した過去の解決済み事例に高い字句類似。source=SIMILARITY・confidence 付きで『準・既知』に分類し、AI 生調査を回さず即確定する（graded confidence）。完全一致（既知）と同じく即・無料でレポートは必要時オンデマンド生成。",
    scenarios: [
      {
        id: "2",
        label: "DBコネクションプール枯渇",
        description:
          "DB コネクションプール枯渇 → 完全一致なし → 過去の解決済み事例に約67%類似 → 準・既知（確度付き）で即確定（AI 生調査なし）",
        realness: "synthetic",
      },
    ],
  },
  {
    chip: "未知 ・ AI が調査",
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
        label: "インフラ障害（実 Cloud Monitoring）",
        description:
          "CRITICAL ログ + HTTP 500 → 実 Cloud Monitoring 経由で発報（GCP のみ・真正性の見せ場）。⏱ Cloud Monitoring のポリシー評価を挟むため、注入からアラート検知まで約1分のラグがあります（実検知経路ゆえの遅延）。インシデントは GCP 側に残り時刻も発報時のまま（閉じる公開 API は無し）。反復・時刻ずれ回避には合成版（4b）を推奨。",
        realness: "cloud",
      },
      {
        id: "4b",
        label: "インフラ障害（合成・反復用）",
        description:
          "4 と同型の Cloud Monitoring 発報を合成注入で即・新鮮に再現（started_at=now・実 CM 非依存）。GCP 側にインシデントを残さずデモ reset で完全に消えるので、審査中の反復・時刻ずれ回避に使う。下流の分類→ADK 調査は 4 と同一経路。",
        realness: "synthetic",
      },
      {
        id: "5",
        label: "脆弱性検知",
        description:
          "CI(Trivy) の HIGH/CRITICAL を合成 → AI 調査 → 修正 PR 起票（DevOps ループ）",
        realness: "synthetic",
      },
      {
        id: "6",
        label: "構成変更障害",
        description:
          "Cloud SQL 設定縮小（IaC apply）が原因 → AI が terraform 差分を特定",
        realness: "synthetic",
      },
      {
        id: "7",
        label: "アプリコード退行",
        description:
          "テスト通過のコード変更が挙動退行 → AI が実コミット差分を読んで原因特定",
        realness: "synthetic",
      },
    ],
  },
];

function ScenarioRow({
  scenario,
  aiRole,
  open,
  busy,
  onToggle,
  onTrigger,
}: {
  scenario: Scenario;
  aiRole: string;
  open: boolean;
  busy: string | null;
  onToggle: () => void;
  onTrigger: (id: string) => void;
}) {
  const realness = REALNESS_META[scenario.realness];
  const panelId = `demo-scenario-${scenario.id}`;
  const running = busy === `scenario:${scenario.id}`;
  const anyBusy = busy !== null;

  return (
    <li className="overflow-hidden rounded-md bg-slate-800/50 ring-1 ring-inset ring-slate-700/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left transition hover:bg-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={`text-xs text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="truncate text-sm font-semibold text-slate-50">
            {scenario.label}
          </span>
        </span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${realness.className}`}
        >
          {realness.label}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="space-y-3 border-t border-slate-700/50 px-3 py-3 text-[13px] leading-relaxed"
        >
          <p className="text-slate-100">{scenario.description}</p>
          <p className="text-slate-300">
            <span className="font-semibold text-slate-200">AI の動き:</span>{" "}
            {aiRole}
          </p>
          <p className="text-slate-300">
            <span
              className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${realness.className}`}
            >
              {realness.label}
            </span>
            {realness.note}
          </p>
          <button
            type="button"
            aria-label={`${scenario.label} を実行`}
            disabled={anyBusy}
            onClick={() => onTrigger(scenario.id)}
            className="w-full rounded-md bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-inset ring-cyan-500/40 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
          >
            {running ? "注入中…" : "▶ この障害を注入する"}
          </button>
        </div>
      )}
    </li>
  );
}

export function ScenarioControls({ busy, onTrigger }: ScenarioControlsProps) {
  // シナリオ単位の段階開示（アコーディオン・同時に1つだけ開く）。
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">デモシナリオ</h3>

      <div className="space-y-3">
        {SCENARIO_GROUPS.map((group) => (
          <div key={group.chip} className="space-y-1.5">
            <h4 className="text-xs font-semibold text-slate-300">
              {group.chip}
            </h4>
            <ul className="space-y-1.5">
              {group.scenarios.map((s) => (
                <ScenarioRow
                  key={s.id}
                  scenario={s}
                  aiRole={group.aiRole}
                  open={openId === s.id}
                  busy={busy}
                  onToggle={() =>
                    setOpenId((cur) => (cur === s.id ? null : s.id))
                  }
                  onTrigger={onTrigger}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
