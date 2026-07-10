import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { Card, DonutChart, Legend, ConfidenceGauge } from "@shared/ui/tremor";
import { useForecastNav } from "@features/forecast/presentation/ForecastProvider";
import type { AnalyticsApi } from "../../infrastructure/analyticsApi";
import {
  patternLabel,
  selectLifecycleAlert,
  type AnalyticsView,
  type ApprovedAlertSummaryDto,
} from "../../domain/AnalyticsView";
import { eventInfo, eventTitle } from "@features/alerts/domain/eventCatalog";
import { LiveStreamStatus } from "@features/alerts/presentation/components/LiveStreamStatus";
import { useAnalytics } from "../hooks/useAnalytics";

export interface AnalyticsPageProps {
  api: AnalyticsApi;
}

/**
 * 学習の軌跡（Knowledge Lifecycle・U5）。
 * 3幕 予防(Forecast)→対応(Alerts)→**学習(Analytics)** の締め。集計ダッシュボードを主役から降ろし、
 * 「未知→AI調査→承認→既知昇格→再一致」の1本のライフサイクル物語を先頭に据える。
 * データは既存 `GET /analytics`（approvedAlerts＋known/unknownCount）のみ＝新API・新contractsゼロ。
 * 調査の実測（92秒/62件）は /analytics に無いので数値化せず、「AI調査」段から既存アラート詳細
 * （証拠フロー）へ深リンクしてそこで見せる。
 */
export function AnalyticsPage({ api }: AnalyticsPageProps) {
  const { analytics, status, error, refresh } = useAnalytics(api);
  // Forecast タブの表示可否＋HIGH バッジ（FORECAST_ENABLED off なら非表示・F7）。
  const forecastNav = useForecastNav();

  return (
    <DefaultLayout
      forecastEnabled={forecastNav.enabled}
      forecastBadge={forecastNav.badge}
      headerSlot={<LiveStreamStatus />}
    >
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-100">
              学習の軌跡
            </h2>
            <p className="text-sm text-slate-300">
              未知の障害を AI が調査し、人間が承認して既知パターンへ。
              一度学べば次からは AI を呼ばず即確定します。使うほど調査は減り、対応は速くなります。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={status === "loading"}
            className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-600 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 disabled:opacity-50"
          >
            更新
          </button>
        </header>

        {status === "loading" && (
          <div className="h-48 animate-pulse rounded-tremor-default bg-slate-800/40" />
        )}

        {status === "error" && (
          <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
            集計の取得に失敗しました。{error?.message}
          </div>
        )}

        {status === "ready" && analytics && (
          <AnalyticsBody analytics={analytics} />
        )}
      </div>
    </DefaultLayout>
  );
}

function AnalyticsBody({ analytics }: { analytics: AnalyticsView }) {
  const lifecycle = selectLifecycleAlert(analytics.approvedAlerts);
  // 集計はチャート（recharts）を含むので、開いたときだけマウントする（初期描画を軽く保つ）。
  const [aggregateOpen, setAggregateOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* ヒーロー: 1件の学習の軌跡（主役） */}
      {lifecycle ? (
        <KnowledgeLifecycleHero
          alert={lifecycle}
          knownCount={analytics.knownCount}
        />
      ) : (
        <Card className="!bg-slate-900/40 !ring-slate-700/60">
          <p className="py-10 text-center text-sm text-slate-400">
            まだ学習の軌跡がありません。
            <br />
            未知のアラートを調査・承認すると、ここに「未知 → 承認 → 既知」の軌跡が現れます。
          </p>
        </Card>
      )}

      {/* 集計（内訳）は主役から降ろして折りたたみに従属化。 */}
      <details
        className="group rounded-tremor-default bg-slate-900/40 ring-1 ring-inset ring-slate-700/60"
        onToggle={(e) => setAggregateOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:text-slate-100">
          <span className="inline-flex items-center gap-2">
            <span className="text-slate-500 transition group-open:rotate-90">
              ›
            </span>
            集計で確かめる（正答率・既知/未知の内訳・件数）
          </span>
        </summary>
        {aggregateOpen && (
          <div className="border-t border-slate-700/60 p-4">
            <AggregateBlock analytics={analytics} />
          </div>
        )}
      </details>

      {/* 蓄積された知識＝承認してクローズした過去の判断。深リンクは維持。 */}
      <ApprovedAlertsSection alerts={analytics.approvedAlerts} />
    </div>
  );
}

/**
 * ライフサイクル・ヒーロー。approvedAlerts の代表1件を横タイムラインで:
 *   [未知] → AI調査（← ここだけ実測を既存アラート詳細へ深リンク） → [承認] → 昇格 → [既知]
 * 具象LLM名は出さず「AI」で統一（設計＝ポートで具象非依存）。
 */
function KnowledgeLifecycleHero({
  alert,
  knownCount,
}: {
  alert: ApprovedAlertSummaryDto;
  knownCount: number;
}) {
  const cause = patternLabel(alert.patternName) ?? "（原因は調査中）";
  const detailHref = `/alerts?focus=${encodeURIComponent(alert.id)}`;

  return (
    <Card className="!bg-slate-900/40 !ring-slate-700/60">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        1件の学習の軌跡
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        初めて見る障害が、AI の調査と人の承認を経て「次から即わかる知識」になるまで。
      </p>

      <div className="mt-4 flex flex-col items-stretch gap-2 md:flex-row md:items-stretch md:gap-0">
        {/* [未知] 入口＝役割（初めて見る障害）を主役に、具体例は補足で */}
        <LifecycleStage tone="cyan" badge="未知" grow>
          <p className="text-sm font-semibold text-slate-100">
            初めて見る障害
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            既知パターンに無く、AI が一から調査
          </p>
          <p
            className="mt-1 truncate text-xs text-slate-500"
            title={alert.eventName}
          >
            例: {eventTitle(alert.eventName)}
          </p>
        </LifecycleStage>

        {/* AI調査コネクタ（唯一の深リンク＝実測はここ） */}
        <LifecycleConnector />
        <Link
          to={detailHref}
          aria-label={`${eventTitle(alert.eventName)} の AI 調査の実測（証拠フロー）を開く`}
          className="shrink-0 self-center rounded-lg bg-cyan-500/10 px-4 py-3 text-center ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/20 hover:ring-cyan-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <p className="text-sm font-semibold text-cyan-200">AI 調査</p>
          <p className="mt-0.5 text-xs text-cyan-100/80">
            実測を開く →
          </p>
        </Link>
        <LifecycleConnector />

        {/* [承認] 知識化の瞬間＝役割（人が原因を確定）主役、原因ラベル＋承認メモは補足 */}
        <LifecycleStage tone="amber" badge="承認" grow>
          <p className="text-sm font-semibold text-slate-100">
            人が原因を確定
          </p>
          <p className="mt-1.5 text-xs">
            <span className="text-slate-400">原因例: </span>
            <span className="text-amber-200" title={alert.patternName ?? cause}>
              {cause}
            </span>
          </p>
          {alert.operatorNote?.trim() && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">
              承認メモ: {alert.operatorNote.trim()}
            </p>
          )}
        </LifecycleStage>

        {/* 昇格コネクタ */}
        <div
          aria-hidden
          className="flex shrink-0 flex-col items-center justify-center self-center px-1.5 text-emerald-400/70"
        >
          <span className="md:hidden">▼ 知識に昇格</span>
          <span className="hidden md:block">▶</span>
          <span className="hidden text-[10px] text-emerald-400/60 md:block">
            昇格
          </span>
        </div>

        {/* [既知] 結論＝役割（次回から即わかる）主役、調査ゼロを補足 */}
        <LifecycleStage tone="emerald" badge="既知" grow>
          <p className="text-sm font-semibold text-emerald-100">
            次回から即わかる
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            同じ障害は AI 調査なしで即確定
          </p>
          {alert.occurrenceCount > 1 && (
            <p className="mt-1 text-xs text-emerald-300/80">
              このパターンは既に {alert.occurrenceCount} 回再一致
            </p>
          )}
        </LifecycleStage>
      </div>

      {/* 支えの数字は1つだけ＝knownCount を「AIを呼ばず即確定した件数」として提示。
          既知一致は InvestigationReport 自体が無い＝「1秒未満」ではなく「調査ゼロ」で honest に。
          vanity% は大書きしない（seed 依存＝数字のハルシネーション批判の的）。 */}
      <div className="mt-4 flex items-baseline gap-3 rounded-tremor-default bg-slate-800/40 px-4 py-3 ring-1 ring-inset ring-slate-700/60">
        <span className="text-2xl font-semibold tabular-nums text-emerald-300">
          {knownCount}
        </span>
        <p className="text-xs text-slate-400">
          <span className="text-slate-200">件</span>
          が既知パターン一致で
          <span className="text-emerald-300">
            AI を呼ばず即確定
          </span>
          （調査ゼロ）。未知だけを AI エージェントが調査します。
        </p>
      </div>
    </Card>
  );
}

const STAGE_TONE: Record<string, string> = {
  cyan: "ring-cyan-500/30 bg-cyan-500/5",
  amber: "ring-amber-500/30 bg-amber-500/5",
  emerald: "ring-emerald-500/30 bg-emerald-500/5",
};

const BADGE_TONE: Record<string, string> = {
  cyan: "bg-cyan-500/15 text-cyan-200 ring-cyan-500/30",
  amber: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
};

function LifecycleStage({
  tone,
  badge,
  grow,
  children,
}: {
  tone: keyof typeof STAGE_TONE;
  badge: string;
  grow?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 self-stretch rounded-lg p-3 ring-1 ring-inset ${
        STAGE_TONE[tone]
      } ${grow ? "flex-1" : ""}`}
    >
      <span
        className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE_TONE[tone]}`}
      >
        {badge}
      </span>
      <div className="mt-2 min-w-0">{children}</div>
    </div>
  );
}

function LifecycleConnector() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center self-center px-1.5 text-cyan-500/70"
    >
      <span className="md:hidden">▼</span>
      <span className="hidden md:block">▶</span>
    </div>
  );
}

/** 従属化した集計ブロック（旧トップ画面＝正答率ゲージ＋既知/未知ドーナツ＋件数カード）。 */
function AggregateBlock({ analytics }: { analytics: AnalyticsView }) {
  const classificationData = [
    { name: "既知パターン一致", value: analytics.knownCount },
    { name: "未知（AI 調査）", value: analytics.unknownCount },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!bg-slate-900/40 !ring-slate-700/60">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            分類正答率
          </h3>
          <div className="mt-4 flex flex-col items-center gap-2">
            {analytics.accuracyPercent === null ? (
              <p className="py-10 text-center text-sm text-slate-400">
                まだフィードバックがありません。
                <br />
                承認/却下を行うと正答率が表示されます。
              </p>
            ) : (
              <>
                <ConfidenceGauge
                  confidence={analytics.accuracy ?? 0}
                  size="xl"
                  label={`${analytics.correctCount}/${analytics.withFeedbackCount} 件が正解`}
                  animate
                />
                <p className="text-xs text-slate-400">
                  フィードバック {analytics.withFeedbackCount} 件を母数に算出
                </p>
              </>
            )}
          </div>
        </Card>

        <Card className="!bg-slate-900/40 !ring-slate-700/60">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            既知 / 未知の内訳
          </h3>
          {analytics.totalAlerts === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              アラートがまだありません。
            </p>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3">
              <DonutChart
                data={classificationData}
                category="value"
                index="name"
                colors={["emerald", "cyan"]}
                valueFormatter={(v) => `${v} 件`}
                className="h-44"
              />
              <Legend
                categories={["既知パターン一致", "未知（AI 調査）"]}
                colors={["emerald", "cyan"]}
              />
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="総アラート" value={analytics.totalAlerts} />
        <StatCard
          label="既知一致"
          value={analytics.knownCount}
          tone="emerald"
        />
        <StatCard
          label="未知（調査）"
          value={analytics.unknownCount}
          tone="cyan"
        />
        <StatCard
          label="承認（正解）"
          value={analytics.correctCount}
          tone="emerald"
        />
        <StatCard
          label="却下（不正解）"
          value={analytics.incorrectCount}
          tone="rose"
        />
      </div>
    </div>
  );
}

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-rose-500",
  WARNING: "bg-amber-500",
  INFO: "bg-sky-500",
  PENDING: "bg-slate-500",
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "たった今";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.round(hr / 24)}日前`;
}

function ApprovedAlertsSection({
  alerts,
}: {
  alerts: readonly ApprovedAlertSummaryDto[];
}) {
  return (
    <Card className="!bg-slate-900/40 !ring-slate-700/60">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          蓄積された知識（承認済みアラート）
        </h3>
        <span className="text-xs text-slate-400">{alerts.length} 件</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        承認してクローズしたアラートの記録です。行をクリックすると詳細を開けます（既知パターンへの昇格もここから辿れます）。
      </p>

      {alerts.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          まだ承認済みのアラートはありません。
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                to={`/alerts?focus=${encodeURIComponent(alert.id)}`}
                className="flex items-center gap-3 rounded-tremor-default bg-slate-800/40 px-3 py-2.5 ring-1 ring-inset ring-slate-700/60 transition hover:bg-slate-800/70 hover:ring-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    SEVERITY_DOT[alert.severity] ?? "bg-slate-500"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline gap-2">
                    {/* アラート一覧と同じ人間語タイトル（eventCatalog）。未登録は eventName にフォールバック。 */}
                    <span className="truncate text-sm font-medium text-slate-100">
                      {eventTitle(alert.eventName)}
                    </span>
                    {eventInfo(alert.eventName) && (
                      <code
                        className="shrink-0 text-xs text-slate-400"
                        title={alert.eventName}
                      >
                        {alert.eventName}
                      </code>
                    )}
                    {alert.occurrenceCount > 1 && (
                      <span className="shrink-0 text-xs text-slate-400">
                        重複 {alert.occurrenceCount}件
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    <span
                      className={
                        alert.classificationType === "known"
                          ? "text-emerald-300"
                          : "text-cyan-300"
                      }
                    >
                      {alert.classificationType === "known"
                        ? "既知: "
                        : "原因候補: "}
                    </span>
                    {/* patternName は空文字で届き得る（salvage 由来の推定パターン名欠落）
                        ＝patternLabel(null 許容) が null を返すので placeholder に倒す。
                        生 enum は人間語化し、生IDは tooltip へ降格（G4）。 */}
                    <span title={alert.patternName ?? undefined}>
                      {patternLabel(alert.patternName) ?? "（パターン未特定）"}
                    </span>
                    {alert.operatorNote ? ` — ${alert.operatorNote}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatRelativeTime(alert.occurredOn)}
                </span>
                <span className="shrink-0 text-slate-600" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const TONE_CLASS: Record<string, string> = {
  default: "text-slate-100",
  emerald: "text-emerald-300",
  cyan: "text-cyan-300",
  rose: "text-rose-300",
};

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <div className="text-center rounded-tremor-default bg-slate-900/40 px-4 py-3 ring-1 ring-inset ring-slate-700/60">
      <p className="text-xs text-slate-300">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}
      >
        {value}
      </p>
    </div>
  );
}
