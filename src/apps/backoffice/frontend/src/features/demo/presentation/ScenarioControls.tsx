/**
 * 障害シナリオ注入ボタン群。backend が実際に注入できるレシピに対応する。
 * 「リアルさのプロファイル」で3群に分けて表示する（誤解防止＝ポートフォリオ評価の肝）:
 *
 *  A群 業務障害（実トリガ）… 1〜3。押下→EC へ注文投入→業務障害イベント→Alert 化（SSE）が
 *      一覧にライブで流れる経路A。main も外部も汚さない。
 *  B群 クラウド実検知（GCP限定）… 4。CRITICAL ログ + HTTP 500 を注入し GCP の Cloud Monitoring 経由で
 *      発報する経路B（ローカルでは Alert は出ない）。6 がこのローカル版なので穴ではなく役割分担。
 *  C群 合成注入 × 実 git 証跡 … 5〜7。検知の**入口だけ合成**し、変換→分類→AI 調査→PR 起票は実経路。
 *      原因/修正の証跡（コミット差分・PR）は demo/regression ブランチの**実物**で、AI が実際に引いて分析する
 *      （5=SecurityScanTranslator / 6=CloudMonitoringAlertTranslator / 7=APPLICATION 直接 ingest）。
 *
 * いずれも backend に対応経路を持つ合成注入で、エンドポイント不在の偽ボタンは作らない。
 * kind は表示分け: live＝実トリガー / synthetic＝検知の入口のみ合成（パイプラインは実経路）。
 */

export interface ScenarioControlsProps {
  /** 実行中アクション識別子（"scenario:1" 等）。対象ボタンを送信中表示にする。 */
  busy: string | null;
  onTrigger: (id: string) => void;
}

type ScenarioKind = "live" | "synthetic";

type Scenario = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kind: ScenarioKind;
};

type ScenarioGroup = {
  readonly title: string;
  readonly scenarios: readonly Scenario[];
};

/** 合成入力シナリオに付ける注記（badge の tooltip ＝ ポートフォリオの誤解防止コピー）。 */
const SYNTHETIC_NOTE =
  "検知の入口のみ合成。変換→分類→AI 調査→PR 起票は実経路。証跡（コミット差分・PR）は demo/regression ブランチの実物。代表値なのは外部コンソールリンク等のみ。";

const SCENARIO_GROUPS: readonly ScenarioGroup[] = [
  {
    title: "業務障害（実トリガ）",
    scenarios: [
      {
        id: "1",
        label: "決済タイムアウト",
        description: "決済が時間切れ → 既知パターンに完全一致",
        kind: "live",
      },
      {
        id: "2",
        label: "在庫不足",
        description: "在庫が足りず予約失敗 → 既知パターン",
        kind: "live",
      },
      {
        id: "3",
        label: "在庫競合",
        description: "同時注文で在庫が競合 → 未知 → AI 調査",
        kind: "live",
      },
    ],
  },
  {
    title: "クラウド実検知（GCP限定）",
    scenarios: [
      {
        id: "4",
        label: "インフラ障害",
        description: "CRITICAL ログ + HTTP 500 → Cloud Monitoring 経由で発報（GCP のみ・6 がローカル版）",
        kind: "live",
      },
    ],
  },
  {
    title: "合成注入 × 実 git 証跡",
    scenarios: [
      {
        id: "5",
        label: "脆弱性検知",
        description: "CI(Trivy) の HIGH/CRITICAL 検知を合成 → AI 調査 → PR 起票（DevOps ループ）",
        kind: "synthetic",
      },
      {
        id: "6",
        label: "構成変更障害",
        description: "Cloud SQL 設定縮小（IaC apply）が原因 → AI が terraform 差分を特定",
        kind: "synthetic",
      },
      {
        id: "7",
        label: "アプリコード退行",
        description: "テスト通過のコード変更が挙動退行 → AI が実コミット差分を読んで原因特定",
        kind: "synthetic",
      },
    ],
  },
];

export function ScenarioControls({ busy, onTrigger }: ScenarioControlsProps) {
  const anyBusy = busy !== null;

  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
        FAULT INJECTION
      </h3>
      <div className="space-y-3">
        {SCENARIO_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {group.title}
            </h4>
            <ul className="space-y-1.5">
              {group.scenarios.map((s) => (
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
                        {s.kind === "synthetic" && (
                          <span
                            title={SYNTHETIC_NOTE}
                            className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-200 ring-1 ring-inset ring-amber-500/30"
                          >
                            合成入力
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {s.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-cyan-300">
                      {/* {running ? "注入中…" : "実行"} */}
                      {/* 遷移が速すぎてUX悪化してるのでいったんコメントアウト */}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="rounded-md bg-slate-800/40 px-2.5 py-2 text-[11px] leading-relaxed text-slate-300 ring-1 ring-inset ring-slate-700/50">
        <span className="font-semibold text-amber-200">合成入力</span>{" "}
        = 検知の入口のみ合成。変換→AI 調査→PR 起票は実経路（本番は実 CI/apply
        から同じ経路）。証跡（コミット差分・PR）は demo/regression
        ブランチの実物で、代表値なのは外部コンソールリンク等のみ。
      </p>
    </div>
  );
}
