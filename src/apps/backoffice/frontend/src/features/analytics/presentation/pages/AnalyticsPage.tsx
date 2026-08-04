import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { Card, DonutChart, Legend, ConfidenceGauge } from "@shared/ui/tremor";
import { EmptyStateFigure } from "@shared/ui/EmptyStateFigure";
import { RiskCardSkeleton } from "@shared/ui/Skeleton";
import { useCountUp } from "@shared/ui/useCountUp";
import { useDocumentTitle } from "@shared/ui/useDocumentTitle";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ChevronRightIcon,
} from "@shared/ui/icons";
import { useForecastNav } from "@features/forecast/presentation/ForecastProvider";
import type { AnalyticsApi } from "../../infrastructure/analyticsApi";
import {
  patternLabel,
  selectLifecycleAlert,
  type AnalyticsView,
  type ApprovedAlertSummaryDto,
} from "../../domain/AnalyticsView";
import { eventInfo, eventTitle } from "@features/alerts/domain/eventCatalog";
import { CITATION_KIND_LABEL } from "@features/alerts/domain/citationGroups";
import type { CitationSourceKind } from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
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
  useDocumentTitle("学習");
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
            <h2 className="text-lg font-bold text-slate-100">
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
          <div aria-busy>
            <RiskCardSkeleton />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
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
        <Card className="!bg-slate-800/40 !ring-0">
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-400">
            <EmptyStateFigure className="text-slate-500" />
            <p>
              まだ学習の軌跡がありません。
              <br />
              未知のアラートを調査・承認すると、ここに「未知 → 承認 → 既知」の軌跡が現れます。
            </p>
          </div>
        </Card>
      )}

      {/* 集計（内訳）は主役から降ろして折りたたみに従属化。 */}
      <details
        className="group rounded-tremor-default bg-slate-800/40"
        onToggle={(e) => setAggregateOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-300 transition hover:text-slate-100">
          <span className="inline-flex items-center gap-2">
            <ChevronRightIcon className="shrink-0 text-slate-500 transition group-open:rotate-90" />
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
  // 学習の軌跡の主役数字は「増えていく」体感を与える（L3 モーション設計・reduced-motion 尊重）。
  const shownKnownCount = Math.round(useCountUp(knownCount));

  return (
    <Card className="!bg-slate-800/40 !ring-0">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-300">
        1件の学習の軌跡
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        初めて見る障害が、AI の調査と人の承認を経て「次から即わかる知識」になるまで。
      </p>

      <div className="mt-4 flex flex-col items-stretch gap-2 md:flex-row md:items-stretch md:gap-0">
        {/* [未知] 入口＝役割（初めて見る障害）を主役に、具体例は補足で */}
        <LifecycleStage tone="cyan" badge="未知" grow>
          <p className="text-sm font-medium text-slate-100">
            初めて見る障害
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            既知パターンに無く、AI が一から調査
          </p>
          <p
            className="mt-1 truncate text-xs text-slate-400"
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
          className="shrink-0 self-center rounded-lg bg-slate-800/60 px-4 py-3 text-center ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <p className="text-sm font-medium text-slate-200">AI 調査</p>
          {/* リンク可能性（Tier2）だけ cyan を残す＝ノード全体は他の AI 調査ノードと同じ中立面。 */}
          <p className="mt-0.5 text-xs text-cyan-300">
            実測を開く →
          </p>
        </Link>
        <LifecycleConnector />

        {/* [承認] 知識化の瞬間＝役割（人が原因を確定）主役、原因ラベル＋承認メモは補足 */}
        <LifecycleStage tone="amber" badge="承認" grow>
          <p className="text-sm font-medium text-slate-100">
            人が原因を確定
          </p>
          <p className="mt-1.5 text-xs">
            <span className="text-slate-400">原因例: </span>
            <span className="text-slate-200" title={alert.patternName ?? cause}>
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
          <span className="md:hidden">
            <ArrowDownIcon className="mr-1 inline-block align-[-0.125em]" />
            知識に昇格
          </span>
          <ArrowRightIcon className="hidden md:block" />
          <span className="hidden text-[10px] text-emerald-400/60 md:block">
            昇格
          </span>
        </div>

        {/* [既知] 結論＝役割（次回から即わかる）主役、調査ゼロを補足 */}
        <LifecycleStage tone="emerald" badge="既知" grow>
          <p className="text-sm font-medium text-slate-100">
            次回から即わかる
          </p>
          <p className="mt-1.5 text-xs text-slate-400">
            同じ障害は AI 調査なしで即確定
          </p>
          {alert.occurrenceCount > 1 && (
            <p className="mt-1 text-xs text-slate-400">
              このパターンは既に {alert.occurrenceCount} 回再一致
            </p>
          )}
        </LifecycleStage>
      </div>

      {/* 支えの数字は1つだけ＝knownCount を「AIを呼ばず即確定した件数」として提示。
          既知一致は InvestigationReport 自体が無い＝「1秒未満」ではなく「調査ゼロ」で honest に。
          vanity% は大書きしない（seed 依存＝数字のハルシネーション批判の的）。 */}
      <div className="mt-4 flex items-baseline gap-3 rounded-tremor-default bg-slate-800/60 px-4 py-3">
        <span className="text-2xl font-semibold tabular-nums text-emerald-300">
          {shownKnownCount}
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
  cyan: "bg-cyan-500/10",
  amber: "bg-amber-500/10",
  emerald: "bg-emerald-500/10",
};

/** 段階バッジは Tier3（分類タグ）＝色相は面だけ・文字は中立（顕著性設計）。 */
const BADGE_TONE: Record<string, string> = {
  cyan: "bg-cyan-500/15 text-slate-200",
  amber: "bg-amber-500/15 text-slate-200",
  emerald: "bg-emerald-500/15 text-slate-200",
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
      className={`min-w-0 self-stretch rounded-lg p-3 ${
        STAGE_TONE[tone]
      } ${grow ? "flex-1" : ""}`}
    >
      <span
        className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium ${BADGE_TONE[tone]}`}
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
      <ArrowDownIcon className="md:hidden" />
      <ArrowRightIcon className="hidden md:block" />
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
        <Card className="!bg-slate-800/40 !ring-0">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-300">
            分類正答率
          </h3>
          <div className="mt-4 flex flex-col items-center gap-2">
            {analytics.accuracyPercent === null ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-400">
                <EmptyStateFigure className="text-slate-500" />
                <p>
                  まだフィードバックがありません。
                  <br />
                  承認/却下を行うと正答率が表示されます。
                </p>
              </div>
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

        <Card className="!bg-slate-800/40 !ring-0">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-300">
            既知 / 未知の内訳
          </h3>
          {analytics.totalAlerts === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-400">
              <EmptyStateFigure className="text-slate-500" />
              アラートがまだありません。
            </div>
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

      <CitationCoverageLine analytics={analytics} />
      <ForecastMeasurementLine analytics={analytics} />
    </div>
  );
}

/**
 * 引用照合率（E2）。正答率が人間の承認/却下を母数にするのに対し、こちらは
 * 「AI が挙げた根拠が実在したか」を収集済み証拠と決定論で突合した結果＝**母数は引用単位**。
 * ％を大きく出さず X/Y の件数で出す（母数を隠した％を出さない方針）。
 */
function CitationCoverageLine({ analytics }: { analytics: AnalyticsView }) {
  const coverage = analytics.citationCoverage;
  if (coverage === null) return null;

  const breakdown = coverage.byKind
    .map(
      ({ kind, count }) =>
        `${CITATION_KIND_LABEL[kind as CitationSourceKind] ?? kind} ${count}`,
    )
    .join("・");

  return (
    <div className="rounded-tremor-default bg-slate-800/40 px-4 py-3 text-xs text-slate-300">
      <p>
        引用{" "}
        <span className="font-semibold tabular-nums text-slate-100">
          {coverage.resolved}/{coverage.total}
        </span>{" "}
        が実在照合済み
        {breakdown !== "" && <span className="text-slate-400">（{breakdown}）</span>}
      </p>
      <p className="mt-1 text-slate-400">
        AI が挙げた根拠を収集済み証拠と決定論で突合した結果。母数は引用単位で、
        照合できなかった引用も分母に残す。
        {coverage.unmeasured > 0 &&
          `照合結果が未保存の引用 ${coverage.unmeasured} 件は集計から除外。`}
      </p>
    </div>
  );
}

const SIGNAL_KIND_LABEL: Record<string, string> = {
  FUTURE_CHANGE: "未来の変更",
  SCHEDULE: "スケジュール",
  MEMORY: "過去インシデント",
};

const RISK_LEVEL_LABEL: Record<string, string> = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

/**
 * 予報の測定（E6-1 / E6-3）。**診断側とは別ブロック**にするのは分母の意味が逆だから——
 * 予報は偽引用を表示前に落とすので、残った側の照合率は定義上 100%。測るのは落とした側で、
 * 出せる指標は率ではなく**破棄の件数**になる。同じ枠に並べると診断側の率まで信用されない。
 * 破棄0でもそのまま出す（「機構が要らなかった」ではなく「まだ発火していない」なので隠さない）。
 */
function ForecastMeasurementLine({ analytics }: { analytics: AnalyticsView }) {
  const m = analytics.forecastMeasurement;
  if (m === null) return null;

  const signalBreakdown = m.signalsByKind
    .map(({ kind, count }) => `${SIGNAL_KIND_LABEL[kind] ?? kind} ${count}`)
    .join("・");
  // 「前例が無くても出る。ただし弱く出る」を数字で示す段。過去インシデントの引用が
  // 無いリスクが何段目に出たかが芯なので、level ごとに (うち前例あり N) を併記する。
  const levelBreakdown = m.byLevel
    .map(
      ({ level, count, withMemoryCitation }) =>
        `${RISK_LEVEL_LABEL[level] ?? level} ${count}（うち前例あり ${withMemoryCitation}）`,
    )
    .join("・");
  const excluded = [
    m.excludedFallback > 0 ? `生成失敗の縮退 ${m.excludedFallback} 件` : null,
    m.excludedNoSignals > 0 ? `シグナル0件の空予報 ${m.excludedNoSignals} 件` : null,
    m.excludedUnmeasured > 0 ? `計測前の予報 ${m.excludedUnmeasured} 件` : null,
  ].filter((entry) => entry !== null);

  return (
    <div className="rounded-tremor-default bg-slate-800/40 px-4 py-3 text-xs text-slate-300">
      <p>
        予報{" "}
        <span className="font-semibold tabular-nums text-slate-100">
          {m.forecasts}
        </span>{" "}
        回のうち、AI が挙げた引用{" "}
        <span className="font-semibold tabular-nums text-slate-100">
          {m.citationsEmitted}
        </span>{" "}
        件中{" "}
        <span className="font-semibold tabular-nums text-slate-100">
          {m.citationsDropped}
        </span>{" "}
        件を実在しない引用として破棄・裏付けの残らなかったリスク{" "}
        <span className="font-semibold tabular-nums text-slate-100">
          {m.risksDropped}
        </span>{" "}
        件を表示前に破棄
      </p>
      <p className="mt-1">
        シグナル{" "}
        <span className="font-semibold tabular-nums text-slate-100">
          {m.signalsCollected}
        </span>{" "}
        件を突合して、リスク{" "}
        <span className="font-semibold tabular-nums text-slate-100">
          {m.risksSurvived}
        </span>{" "}
        件に絞り込み
        {signalBreakdown !== "" && (
          <span className="text-slate-400">（{signalBreakdown}）</span>
        )}
      </p>
      <p className="mt-1 text-slate-400">危険度: {levelBreakdown}</p>
      <p className="mt-1 text-slate-400">
        予報は実在しない引用を表示前に落とすので、残った引用の照合率は定義上 100%
        になる。ここで数えているのは落とした側＝率ではなく件数で出す。
        {excluded.length > 0 && `集計から除外: ${excluded.join("・")}。`}
      </p>
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
    <Card className="!bg-slate-800/40 !ring-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-300">
          蓄積された知識（承認済みアラート）
        </h3>
        <span className="flex items-baseline gap-3 text-xs text-slate-400">
          {/* 行頭ドットの意味（severity）。色だけの未定義記号にしない＝静止画でも読める凡例。 */}
          <span className="hidden items-baseline gap-2 text-[10px] sm:flex" aria-hidden>
            {(["CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
              <span key={sev} className="inline-flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[sev]}`}
                />
                {sev}
              </span>
            ))}
          </span>
          <span>{alerts.length} 件</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        承認してクローズしたアラートの記録です。行をクリックすると詳細を開けます（既知パターンへの昇格もここから辿れます）。
      </p>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-slate-400">
          <EmptyStateFigure className="text-slate-500" />
          まだ承認済みのアラートはありません。
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                to={`/alerts?focus=${encodeURIComponent(alert.id)}`}
                className="flex items-center gap-3 rounded-tremor-default bg-slate-800/40 px-3 py-2.5 transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    SEVERITY_DOT[alert.severity] ?? "bg-slate-500"
                  }`}
                  title={`重大度: ${alert.severity}`}
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
                    {/* 「既知」だけ emerald＝学習成果の報酬色。候補（未確定）は中立に沈める。 */}
                    <span
                      className={
                        alert.classificationType === "known"
                          ? "text-emerald-300"
                          : "text-slate-400"
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
                <span className="shrink-0 text-xs text-slate-400">
                  {formatRelativeTime(alert.occurredOn)}
                </span>
                <ChevronRightIcon className="shrink-0 text-slate-600" />
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
  const shown = Math.round(useCountUp(value)); // L3: 集計数字も揃ってカウントアップ
  return (
    <div className="text-center rounded-tremor-default bg-slate-800/40 px-4 py-3">
      <p className="text-xs text-slate-300">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}
      >
        {shown}
      </p>
    </div>
  );
}
