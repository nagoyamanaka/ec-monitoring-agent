import { Link } from "react-router-dom";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { Card, DonutChart, Legend, ConfidenceGauge } from "@shared/ui/tremor";
import { useForecastNav } from "@features/forecast/presentation/ForecastProvider";
import type { AnalyticsApi } from "../../infrastructure/analyticsApi";
import type {
  AnalyticsView,
  ApprovedAlertSummaryDto,
} from "../../domain/AnalyticsView";
import { eventInfo, eventTitle } from "@features/alerts/domain/eventCatalog";
import { useAnalytics } from "../hooks/useAnalytics";

export interface AnalyticsPageProps {
  api: AnalyticsApi;
}

/**
 * AI 分類の精度トラッキング（タスク11）。
 * backend `GET /analytics` の集計を Tremor で可視化する: 正答率ゲージ＋既知/未知ドーナツ＋件数カード。
 * 集計は read モデル（pull on-demand）。SSE には乗せない（step4-1 §10）。
 */
export function AnalyticsPage({ api }: AnalyticsPageProps) {
  const { analytics, status, error, refresh } = useAnalytics(api);
  // Forecast タブの表示可否＋HIGH バッジ（FORECAST_ENABLED off なら非表示・F7）。
  const forecastNav = useForecastNav();

  return (
    <DefaultLayout
      forecastEnabled={forecastNav.enabled}
      forecastBadge={forecastNav.badge}
    >
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-100">
              AI 分類の精度
            </h2>
            <p className="text-sm text-slate-300">
              オペレーターの承認/却下フィードバックを母数に、AI
              分類の正答率と既知/未知の内訳を集計します。
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
  const classificationData = [
    { name: "既知パターン一致", value: analytics.knownCount },
    { name: "未知（AI 調査）", value: analytics.unknownCount },
  ];

  return (
    <div className="space-y-6">
      {/* 上段: 正答率ゲージ ＋ 既知/未知ドーナツ */}
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

      {/* 下段: 件数カード */}
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

      {/* 承認済みアラート（過去の判断）。現役一覧＝要対処／ここ＝クローズ済みの判断記録。 */}
      <ApprovedAlertsSection alerts={analytics.approvedAlerts} />
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
          承認済みアラート（過去の判断）
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
                        : "AI推定: "}
                    </span>
                    {alert.patternName ?? "（パターン未特定）"}
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
