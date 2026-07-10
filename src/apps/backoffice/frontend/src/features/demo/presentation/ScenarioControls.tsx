import { Fragment, useState } from "react";
import type {
  PendingDetection,
  TriggerOptions,
} from "./hooks/useDemoControls";
import { DetectionPendingBanner } from "./DetectionPendingBanner";

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
 *
 * **認知負荷トリム（D2）**: パネル内の文は各1行に圧縮し、正直さの担保（realness の詳細）は
 * バッジのホバー（title）へ退避＝「読む物」でなく「一目で分かる」。詳細文言は tooltip に残すので
 * 正直さの情報自体は失わない。
 */

export interface ScenarioControlsProps {
  /** 実行中アクション識別子（"scenario:1" 等）。対象ボタンを送信中表示にする。 */
  busy: string | null;
  onTrigger: (id: string, opts?: TriggerOptions) => void;
  /**
   * 実検知経路の「検知待ち」状態。該当シナリオ行の直下にバナーを出す（近接性＝
   * 押した場所のすぐ下に反応を出し、原因と結果を空間的にくっつける）。null なら出さない。
   */
  pendingDetection?: PendingDetection | null;
  /** 検知待ちバナーを手動で閉じる。 */
  onDismissPending?: () => void;
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

/**
 * リアルさバッジの表示名・配色・説明。
 * `short` はパネルに常時出す1行（一目で分かる）、`note` はバッジホバー（title）にだけ出す全文（正直さの担保）。
 */
const REALNESS_META: Record<
  Realness,
  { label: string; className: string; short: string; note: string }
> = {
  // 顕著性設計（予兆コンソールと同一規約）: 「実」系は emerald/sky 面＋中立文字、「合成」は無彩色。
  live: {
    label: "実トリガ",
    className: "bg-emerald-500/15 text-slate-200",
    short: "EC へ実注文 → Alert 化まで実経路",
    note: "EC へ実際に注文を投入し、業務障害イベントから Alert 化まで実経路で流す。main も外部も汚さない。",
  },
  cloud: {
    label: "クラウド実検知",
    className: "bg-sky-500/15 text-slate-200",
    short: "GCP Cloud Monitoring が実発報（GCP のみ）",
    note: "GCP に CRITICAL ログ + HTTP 500 を注入し、Cloud Monitoring 経由で発報する実検知経路（GCP デプロイ時のみ）。",
  },
  synthetic: {
    label: "合成入力",
    className: "bg-slate-700/40 text-slate-400",
    short: "入口のみ合成・以降のパイプラインは実経路・実 AI",
    note: "障害の入口だけを合成（本番では実 CI／実 apply／実ログが同じ入口に入る）。変換→分類→AI 調査→修正提案のパイプラインはすべて実経路・実 AI。",
  },
};

const SCENARIO_GROUPS: readonly ScenarioGroup[] = [
  {
    chip: "既知 ・ 即確定",
    aiRole:
      "既知パターンに完全一致 → 即・無料・決定論で確定（AI 自動起動なし。レポートは詳細から必要時に生成）。",
    scenarios: [
      {
        id: "1",
        label: "決済タイムアウト",
        description: "決済が時間切れ → 既知パターンに完全一致 → 即確定",
        realness: "live",
      },
    ],
  },
  {
    chip: "類似 ・ 即確定（確度付き）",
    aiRole:
      "過去の解決済み事例に高い字句類似 → 確度付きの『準・既知』として即・無料で確定（AI 生調査なし）。",
    scenarios: [
      {
        id: "2",
        label: "決済プロバイダ拒否",
        description: "与信が全件拒否 → 完全一致なし → 過去事例に約71%類似 → 確度付きで即確定",
        realness: "live",
      },
    ],
  },
  {
    chip: "未知 ・ AI が調査",
    aiRole:
      "ADK マルチエージェントが実ログ・実コミット差分を引用して調査 → 承認で既知パターンへ昇格（学習ループ）。",
    scenarios: [
      {
        id: "3",
        label: "インフラ障害（実 Cloud Monitoring）",
        description:
          "CRITICAL ログ + HTTP 500 → 実 Cloud Monitoring が発報（GCP のみ）。⏱ 検知まで約1分・GCP にインシデントが残るため、反復は 3b を推奨",
        realness: "cloud",
      },
      {
        id: "3b",
        label: "インフラ障害（合成・反復用）",
        description:
          "3 と同型の発報を合成で即・新鮮に再現（reset で消える・反復用）。下流の分類→AI 調査は 3 と同一経路",
        realness: "synthetic",
      },
      {
        id: "4",
        label: "脆弱性検知",
        description:
          "CI(Trivy) の HIGH/CRITICAL を合成 → AI 調査 → 修正 PR 起票（DevOps ループ）",
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
  onTrigger: (id: string, opts?: TriggerOptions) => void;
}) {
  const realness = REALNESS_META[scenario.realness];
  const panelId = `demo-scenario-${scenario.id}`;
  const running = busy === `scenario:${scenario.id}`;
  const anyBusy = busy !== null;

  return (
    <li className="overflow-hidden rounded-md bg-slate-800/50">
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
          {/* 「インフラ障害（実 Cl...」のような尻切れを避けるため truncate せず2行まで許容（E7）。 */}
          <span className="line-clamp-2 text-sm font-medium leading-snug text-slate-50">
            {scenario.label}
          </span>
        </span>
        <span
          title={realness.note}
          className={`shrink-0 cursor-help rounded-md px-2 py-0.5 text-[11px] font-medium ${realness.className}`}
        >
          {realness.label}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="space-y-2 border-t border-slate-700/50 px-3 py-3 text-[13px] leading-relaxed"
        >
          <p className="text-slate-100">{scenario.description}</p>
          <p className="text-slate-300">
            <span className="font-medium text-slate-200">AI の動き:</span>{" "}
            {aiRole}
          </p>
          {/* 凡例の全文はバッジホバー（title）へ退避し、常時表示は1行だけ（D2 認知負荷トリム）。 */}
          <p className="text-slate-400">
            <span
              title={realness.note}
              className={`mr-1.5 cursor-help rounded-md px-1.5 py-0.5 text-[11px] font-medium ${realness.className}`}
            >
              {realness.label}
            </span>
            {realness.short}
          </p>
          <button
            type="button"
            aria-label={`${scenario.label} を実行`}
            disabled={anyBusy}
            onClick={() =>
              // 実検知経路（クラウド実検知）は Alert 着弾まで数十秒かかるので、
              // 注入後に「検知待ち」ナレーションを出すよう awaitDetection を渡す。
              onTrigger(
                scenario.id,
                scenario.realness === "cloud"
                  ? {
                      awaitDetection: true,
                      label: scenario.label,
                      // 実 Cloud Monitoring 発報は INFRASTRUCTURE で着弾する。
                      // この category の新規アラートが来たときだけバナーを畳む。
                      matchCategory: "INFRASTRUCTURE",
                    }
                  : undefined,
              )
            }
            className="w-full rounded-md bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 ring-1 ring-inset ring-cyan-500/40 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
          >
            {running ? "注入中…" : "▶ この障害を注入する"}
          </button>
        </div>
      )}
    </li>
  );
}

export function ScenarioControls({
  busy,
  onTrigger,
  pendingDetection,
  onDismissPending,
}: ScenarioControlsProps) {
  // シナリオ単位の段階開示（アコーディオン・同時に1つだけ開く）。
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-100">デモシナリオ</h3>

      <div className="space-y-3">
        {SCENARIO_GROUPS.map((group) => (
          <div key={group.chip} className="space-y-1.5">
            <h4 className="text-xs font-medium text-slate-300">
              {group.chip}
            </h4>
            <ul className="space-y-1.5">
              {group.scenarios.map((s) => (
                <Fragment key={s.id}>
                  <ScenarioRow
                    scenario={s}
                    aiRole={group.aiRole}
                    open={openId === s.id}
                    busy={busy}
                    onToggle={() =>
                      setOpenId((cur) => (cur === s.id ? null : s.id))
                    }
                    onTrigger={onTrigger}
                  />
                  {/* 押した行の直下に検知待ちバナーを出す（近接性）。 */}
                  {pendingDetection?.scenarioId === s.id && onDismissPending && (
                    <li className="list-none">
                      <DetectionPendingBanner
                        pending={pendingDetection}
                        onDismiss={onDismissPending}
                      />
                    </li>
                  )}
                </Fragment>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
