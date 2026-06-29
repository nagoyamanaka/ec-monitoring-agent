import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { Card, DonutChart, Legend, ConfidenceGauge } from "@shared/ui/tremor";
import type { AnalyticsApi } from "../../infrastructure/analyticsApi";
import type { AnalyticsView } from "../../domain/AnalyticsView";
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

  return (
    <DefaultLayout>
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
    </div>
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
