import { cn } from "@shared/ui/cn";
import type { AlertView } from "../../domain/AlertView";
import type { InvestigationStepView } from "../../domain/InvestigationReportView";
import {
  hasPullRequest,
  isRemediationUnstarted,
  type RemediationView,
} from "../../domain/RemediationView";
import type { RemediationApi } from "../../infrastructure/remediationApi";
import { useRemediation } from "../hooks/useRemediation";
import { InvestigationItem } from "./InvestigationItem";

export interface RemediationPanelProps {
  alert: AlertView;
  api: RemediationApi;
  /** SSE で届いた当該アラートの最新確定（あれば即反映＝live 経路）。 */
  pushed?: RemediationView | null;
  /** SSE で更新が届く前提か。true ならポーリングしない。 */
  live?: boolean;
  /** live=false 時のポーリング間隔（ms）。テストで短縮する。 */
  pollIntervalMs?: number;
  className?: string;
}

/**
 * リメディエーション（修正 PR 起票）パネル＝シナリオ5の見せ場（タスク9）。
 * 調査(read)と修正(write)は分離され、起票は人間の承認アクション。よって
 * AI が「コードで直せる」と判定した（report.remediable）ときだけ起票ボタンを活性にする。
 * 起票後は status を表示し、dispatched の間はポーリングで drafted/failed の確定を反映する。
 */
export function RemediationPanel({
  alert,
  api,
  pushed,
  live,
  pollIntervalMs,
  className,
}: RemediationPanelProps) {
  const { remediation, status, error, submitting, draft } = useRemediation(
    api,
    alert.id,
    { pushed, live, pollIntervalMs },
  );

  const report = alert.report;
  const remediable = report?.remediable ?? false;
  const unstarted = remediation === null || isRemediationUnstarted(remediation);
  // AI が remediable=true としても、自動修正エンジンが対象を見つけられず skip した場合は
  // 「コードで修正可能」バッジと skip 文言が矛盾して見える。skip 済みならバッジを伏せる。
  const skipped = remediation?.status === "skipped";

  // 起票できず（remediable でない）、まだ何の記録も無いなら出さない（ノイズ回避）。
  if (!remediable && unstarted && status !== "error") {
    return null;
  }

  return (
    <section
      className={cn("space-y-3", className)}
      aria-label="リメディエーション"
    >
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          自動修正（リメディエーション）
        </h4>
        {remediable && !skipped && (
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
            コードで修正可能（AI 判定）
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="h-10 animate-pulse rounded-md bg-slate-800/40" />
      )}

      {status === "error" && (
        <div className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-inset ring-rose-500/30">
          リメディエーション状態の取得に失敗しました。{error?.message}
        </div>
      )}

      {status === "ready" && remediation && (
        <RemediationBody
          remediation={remediation}
          remediable={remediable}
          submitting={submitting}
          onDraft={draft}
          suggestedActions={report?.suggestedActions ?? []}
        />
      )}
    </section>
  );
}

function RemediationBody({
  remediation,
  remediable,
  submitting,
  onDraft,
  suggestedActions,
}: {
  remediation: NonNullable<
    ReturnType<typeof useRemediation>["remediation"]
  >;
  remediable: boolean;
  submitting: boolean;
  onDraft: () => void | Promise<void>;
  suggestedActions: InvestigationStepView[];
}) {
  switch (remediation.status) {
    case "none":
      return (
        <div className="space-y-3 rounded-md bg-slate-800/40 px-3 py-3 ring-1 ring-inset ring-slate-700/60">
          {suggestedActions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">
                修正方針（AI 提案・ROI 判断材料）
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-200 marker:text-cyan-500/70">
                {suggestedActions.map((a, i) => (
                  <li key={i}>
                    <InvestigationItem item={a} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            disabled={!remediable || submitting}
            onClick={() => onDraft()}
            className="min-w-[8rem] rounded-md bg-cyan-500/15 px-3 py-1.5 text-center text-xs font-semibold text-cyan-200 ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            {submitting ? "起票中…" : "修正を起票"}
          </button>
          {!remediable && (
            <p className="text-[11px] text-slate-400">
              このアラートは AI が「コードでの自動修正は不適」と判定しています。
            </p>
          )}
        </div>
      );

    case "dispatched":
      return (
        <div className="flex items-center gap-2 rounded-md bg-slate-800/40 px-3 py-3 text-xs text-slate-300 ring-1 ring-inset ring-slate-700/60">
          <span
            aria-hidden
            className="h-2 w-2 animate-pulse rounded-full bg-cyan-400"
          />
          CI が修正中です…（受付済み・結果を待っています）
        </div>
      );

    case "drafted":
      return (
        <div className="space-y-2 rounded-md bg-emerald-500/10 px-3 py-3 ring-1 ring-inset ring-emerald-500/25">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
              修正 PR 作成済み
            </span>
            {remediation.vulnerabilityCount > 0 && (
              <span className="text-[11px] text-emerald-200/80">
                検出 {remediation.vulnerabilityCount} 件
              </span>
            )}
          </div>
          {hasPullRequest(remediation) && (
            <a
              href={remediation.pullRequestUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
            >
              修正 PR を開く →
            </a>
          )}
        </div>
      );

    case "skipped":
      return (
        <div className="space-y-1 rounded-md bg-slate-800/40 px-3 py-3 text-xs text-slate-300 ring-1 ring-inset ring-slate-700/60">
          <p>自動修正は実行されませんでした。</p>
          {remediation.reason && (
            <p className="text-slate-400">{remediation.reason}</p>
          )}
        </div>
      );

    case "failed":
      return (
        <div className="rounded-md bg-amber-500/10 px-3 py-3 text-xs text-amber-200 ring-1 ring-inset ring-amber-500/25">
          自動修正に失敗しました。
          {remediation.reason && (
            <span className="text-amber-200/80">（{remediation.reason}）</span>
          )}
        </div>
      );

    default:
      return null;
  }
}
