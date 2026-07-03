import { useCallback, useState } from "react";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { HttpError } from "@shared/api/HttpClient";
import { formatDateTimeJa } from "@shared/format/dateTime";
import { useForecastData, useForecastNav } from "../ForecastProvider";
import type { ForecastBriefingView } from "../../domain/ForecastView";
import { RiskCard } from "../components/RiskCard";

const PANEL = "rounded-xl border border-slate-800/80 bg-slate-900/40 p-5";

/**
 * 予兆ブリーフィングページ（step6 F7）。リスク一覧を level 降順で出す。
 * GET は事前生成済みキャッシュ（無人閲覧・課金ゼロ）、生成ボタンだけが POST（DEMO_ENABLED 配下）。
 * reactive（/alerts）とは画面を分ける＝一覧へ予報コンテンツを混載しない（step4-2 の決定を維持）。
 */
export function ForecastPage() {
  const { snapshot, status, error, refresh, generating, generate } =
    useForecastData();
  const nav = useForecastNav();
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    try {
      await generate();
    } catch (e) {
      // POST は DEMO_ENABLED 配下＝off の環境では 404 が返る（forecastGuard 通過後の demoGuard）。
      setGenerateError(
        e instanceof HttpError && e.status === 404
          ? "この環境ではデモ操作（予報の生成）が無効です。表示できるのは事前生成済みの予報のみです。"
          : "予報の生成に失敗しました。時間をおいて再試行してください。",
      );
    }
  }, [generate]);

  const briefing = snapshot?.kind === "ready" ? snapshot.briefing : null;

  return (
    <DefaultLayout forecastEnabled={nav.enabled} forecastBadge={nav.badge}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            <h2 className="text-lg font-semibold text-slate-100">
              予兆ブリーフィング
            </h2>
            <p className="text-sm text-slate-300">
              障害が<strong className="text-slate-100">起きる前</strong>
              に、未マージ PR・未適用のインフラ変更・負荷スケジュール・
              過去の同型事例を AI が突合して直近のリスクを予報します。
              根拠（引用）は実在シグナルと照合済みのものだけを表示します。
            </p>
          </div>
          {snapshot && snapshot.kind !== "disabled" && (
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating}
              className="shrink-0 rounded-md bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 disabled:opacity-50"
            >
              {generating
                ? "予報を生成中…（1分ほどかかります）"
                : briefing
                  ? "予報を再生成"
                  : "予報を生成"}
            </button>
          )}
        </header>

        {generateError && (
          <div
            role="alert"
            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            {generateError}
          </div>
        )}

        {status === "loading" && (
          <div className="h-48 animate-pulse rounded-xl bg-slate-800/40" />
        )}

        {status === "error" && (
          <div className={PANEL}>
            <p className="text-sm text-slate-300">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-600 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              再試行
            </button>
          </div>
        )}

        {status === "ready" && snapshot?.kind === "disabled" && (
          <div className={PANEL}>
            <p className="text-sm text-slate-300">
              予兆ブリーフィングはこの環境では無効です（FORECAST_ENABLED off）。
            </p>
          </div>
        )}

        {status === "ready" && snapshot?.kind === "empty" && (
          <div className={PANEL}>
            <p className="text-sm text-slate-300">
              予報はまだ生成されていません。「予報を生成」で、現在のシグナル
              （未マージ PR・未適用 plan・スケジュール・過去事例）から最初の予報を作成できます。
            </p>
          </div>
        )}

        {briefing && (
          <BriefingBody briefing={briefing} />
        )}
      </div>
    </DefaultLayout>
  );
}

function BriefingBody({ briefing }: { briefing: ForecastBriefingView }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="rounded-full bg-slate-700/40 px-2 py-0.5 font-medium text-slate-300">
          対象: {briefing.horizon}
        </span>
        <span>生成: {formatDateTimeJa(briefing.generatedAt)}</span>
        <span>評価シグナル: {briefing.signalCount} 件</span>
      </div>

      {briefing.isFallback && (
        <div
          role="alert"
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          予報の生成に失敗したため、リスク評価を表示できません。「予報を再生成」をお試しください。
        </div>
      )}

      {!briefing.isFallback && briefing.risks.length === 0 && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          現時点で予兆リスクは検出されていません（シグナル {briefing.signalCount}{" "}
          件を評価済み）。
        </div>
      )}

      {briefing.risks.length > 0 && (
        <div className="space-y-4" aria-label="予兆リスク一覧">
          {briefing.risks.map((risk, i) => (
            <RiskCard key={`${risk.subject}-${i}`} risk={risk} />
          ))}
        </div>
      )}
    </div>
  );
}
