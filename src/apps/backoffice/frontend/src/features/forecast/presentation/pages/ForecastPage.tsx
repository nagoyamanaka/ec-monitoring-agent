import { useCallback, useEffect, useState } from "react";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { HttpError } from "@shared/api/HttpClient";
import { EmptyStateFigure } from "@shared/ui/EmptyStateFigure";
import { RiskCardSkeleton } from "@shared/ui/Skeleton";
import { useDocumentTitle } from "@shared/ui/useDocumentTitle";
import type { DemoApi } from "@features/demo/infrastructure/demoApi";
import { LiveStreamStatus } from "@features/alerts/presentation/components/LiveStreamStatus";
import { useForecastData, useForecastNav } from "../ForecastProvider";
import type { ForecastBriefingView } from "../../domain/ForecastView";
import { RiskCard } from "../components/RiskCard";
import { ForecastBridgeCta } from "../components/ForecastBridgeCta";
import { ForecastDemoConsole } from "../components/ForecastDemoConsole";
import { ForecastGenerationPendingBanner } from "../components/ForecastGenerationPendingBanner";

const PANEL = "rounded-lg bg-slate-800/40 p-5";

/**
 * 予兆ブリーフィングページ（step6 F7/F11/F12）。リスク一覧を level 降順で出す。
 * GET は事前生成済みキャッシュ（無人閲覧・課金ゼロ）。生成/リセットのデモ操作は
 * アラート一覧と同型の**デモコンソール**（右 aside・F12）に閉じ込め、予報本文＝
 * プロダクション面を侵食しない。DEMO_ENABLED off（/demo/status 404）ならコンソール
 * ごと非表示（DemoDrawer と同じ可用性判定）。
 * reactive（/alerts）とは画面を分ける＝一覧へ予報コンテンツを混載しない（step4-2 の決定を維持）。
 */
export interface ForecastPageProps {
  demoApi: DemoApi;
}

export function ForecastPage({ demoApi }: ForecastPageProps) {
  useDocumentTitle("予兆");
  const {
    snapshot,
    status,
    error,
    refresh,
    generating,
    generate,
    resetting,
    reset,
  } = useForecastData();
  const nav = useForecastNav();
  const [actionError, setActionError] = useState<string | null>(null);

  // デモ可用性（DemoDrawer と同じ /demo/status 404 判定）。404=本番＝コンソールを伏せる。
  const [demoAvailable, setDemoAvailable] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    demoApi
      .getStatus(abort.signal)
      .then(() => setDemoAvailable(true))
      .catch((e) => {
        if (abort.signal.aborted) return;
        if (e instanceof HttpError && e.status === 404) {
          setDemoAvailable(false);
        }
        // その他のエラーは可用性不明のまま（コンソールは出し、操作時のエラーで表面化）。
      });
    return () => abort.abort();
  }, [demoApi]);

  const handleGenerate = useCallback(async () => {
    setActionError(null);
    try {
      await generate();
    } catch (e) {
      // POST は DEMO_ENABLED 配下＝off の環境では 404 が返る（forecastGuard 通過後の demoGuard）。
      setActionError(
        e instanceof HttpError && e.status === 404
          ? "この環境ではデモ操作（予報の生成）が無効です。表示できるのは事前生成済みの予報のみです。"
          : "予報の生成に失敗しました。時間をおいて再試行してください。",
      );
    }
  }, [generate]);

  const handleReset = useCallback(async () => {
    setActionError(null);
    try {
      await reset();
    } catch (e) {
      setActionError(
        e instanceof HttpError && e.status === 404
          ? "この環境ではデモ操作（予報のリセット）が無効です。"
          : "予報のリセットに失敗しました。時間をおいて再試行してください。",
      );
    }
  }, [reset]);

  const briefing = snapshot?.kind === "ready" ? snapshot.briefing : null;
  const showConsole =
    demoAvailable && snapshot !== null && snapshot.kind !== "disabled";

  return (
    <DefaultLayout
      forecastEnabled={nav.enabled}
      forecastBadge={nav.badge}
      headerSlot={<LiveStreamStatus />}
    >
      <div
        className={
          showConsole
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
            : "grid grid-cols-1 gap-6"
        }
      >
        <div className="space-y-6">
          <header>
            <div className="max-w-2xl space-y-1">
              <h2 className="text-lg font-bold text-slate-100">
                予兆ブリーフィング
              </h2>
              <p className="text-sm text-slate-300">
                障害が
                <strong className="text-slate-100">
                  起きる前に、根拠付きで予報し、いま打てる先手
                </strong>
                まで提示します——引用は実在シグナルと照合済みのものだけ。
              </p>
            </div>
          </header>

          {/* 生成中は結果が着地する本文側で進行状況を見せる（3b の検知待ちバナーと同型・F12改）。 */}
          {generating && (
            <ForecastGenerationPendingBanner regenerating={briefing !== null} />
          )}

          {status === "loading" && (
            <div aria-busy>
              <RiskCardSkeleton />
            </div>
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
            <div className={`${PANEL} flex flex-col items-center gap-3 text-center`}>
              <EmptyStateFigure variant="disabled" className="text-slate-500" />
              <p className="text-sm text-slate-300">
                予兆ブリーフィングはこの環境では無効です（FORECAST_ENABLED
                off）。
              </p>
            </div>
          )}

          {/* 生成中は「生成してください」の案内が矛盾するので伏せる（バナーが代替）。 */}
          {status === "ready" && snapshot?.kind === "empty" && !generating && (
            <div className={`${PANEL} flex flex-col items-center gap-3 text-center`}>
              <EmptyStateFigure className="text-slate-500" />
              <p className="text-sm text-slate-300">
                予報はまだ生成されていません。
                {showConsole && (
                  <>
                    <br />→
                    右のデモコンソールから「予報を生成」を実行してください（投入済みシグナルの内訳もそこに出ています）。
                  </>
                )}
              </p>
            </div>
          )}

          {briefing &&
            (generating ? (
              // 再生成中: 前回分を暗転して残す（空白にしない・新旧の取り違えも防ぐ）。
              <div aria-busy className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  前回の予報（再生成が完成すると置き換わります）
                </p>
                <div className="pointer-events-none opacity-40">
                  <BriefingBody briefing={briefing} />
                </div>
              </div>
            ) : (
              <BriefingBody briefing={briefing} />
            ))}
        </div>

        {showConsole && (
          <aside className="lg:sticky lg:top-20 lg:h-fit">
            <ForecastDemoConsole
              hasBriefing={briefing !== null}
              generating={generating}
              resetting={resetting}
              actionError={actionError}
              onGenerate={() => void handleGenerate()}
              onReset={() => void handleReset()}
            />
          </aside>
        )}
      </div>
    </DefaultLayout>
  );
}

function BriefingBody({ briefing }: { briefing: ForecastBriefingView }) {
  return (
    <div className="space-y-4">
      {/* ⚠ 2026-08-05: 3つのメタチップ（対象 / 生成 / 評価シグナル）を一覧の見出しへ畳んだ。
          「対象: 今週末」と「生成: …」は**時間軸が日付つきでより正確に言うようになった**ので
          重複。horizon は捨てずに一覧の見出し（「今週末のリスク」）へ昇格させ、スコープを
          示す役に変えた。**シグナル件数だけは残す**——これは母数で、「何件見て何件出したか」が
          この製品の規律の中心にあり、消すと質疑での答えが画面から消える。文言は E6-3 の
          画面文言（「シグナル N 件を突合して、リスク M 件に絞り込み」）に揃える。 */}
      <div className="space-y-1">
        <h2 className="text-sm font-bold tracking-wide text-slate-200">
          {briefing.horizon}のリスク
        </h2>
        <p className="text-xs text-slate-400">
          シグナル {briefing.signalCount} 件を突合して、リスク {briefing.risks.length}{" "}
          件に絞り込み
        </p>
      </div>

      {briefing.isFallback && (
        <div
          role="alert"
          className="rounded-md bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          予報の生成に失敗したため、リスク評価を表示できません。「予報を再生成」をお試しください。
        </div>
      )}

      {!briefing.isFallback && briefing.risks.length === 0 && (
        <div className="rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          現時点で予兆リスクは検出されていません（シグナル {briefing.signalCount}{" "}
          件を評価済み）。
        </div>
      )}

      {briefing.risks.length > 0 && (
        <>
          <div className="space-y-5" aria-label="予兆リスク一覧">
            {briefing.risks.map((risk, i) => (
              <RiskCard
                key={`${risk.subject}-${i}`}
                risk={risk}
                generatedAt={briefing.generatedAt}
              />
            ))}
          </div>
          {/* F10-②/F11b: 橋渡しCTA（保険）。risks がある時だけ・ページ単位で1個 */}
          <ForecastBridgeCta />
        </>
      )}
    </div>
  );
}
