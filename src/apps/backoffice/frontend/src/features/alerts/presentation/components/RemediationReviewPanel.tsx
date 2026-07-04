import type { ComponentType } from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@shared/ui/DecisionIcon";
import type {
  RemediationReviewView,
  RemediationVerdict,
} from "../../domain/InvestigationReportView";
import { CitationChips } from "./CitationChips";

export interface RemediationReviewPanelProps {
  review: RemediationReviewView;
}

/** 判定の表示用ラベル＋配色＋アイコン。reject は誤修正＝危険色、concerns は要確認＝注意色。 */
const VERDICT_STYLE: Record<
  RemediationVerdict,
  {
    label: string;
    className: string;
    Icon: ComponentType<{ className?: string }>;
  }
> = {
  pass: {
    label: "整合（pass）",
    className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    Icon: CheckCircleIcon,
  },
  concerns: {
    label: "要確認（concerns）",
    className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    Icon: AlertTriangleIcon,
  },
  reject: {
    label: "不整合（reject）",
    className: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    Icon: XCircleIcon,
  },
};

/**
 * 修正PR自動レビュー結果パネル（報告用フル・詳細ページのみ）。
 * verdict・懸念点・レビュー対象 PR リンク・判定根拠（citations）を全表示する（タスク36/37）。
 * verdict は出すだけで自動マージはしない（承認・マージは人間の reviewStatus ゲート）。
 */
export function RemediationReviewPanel({ review }: RemediationReviewPanelProps) {
  const verdict = VERDICT_STYLE[review.verdict];
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          修正PR 自動レビュー
        </h4>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${verdict.className}`}
        >
          <verdict.Icon className="h-3 w-3 shrink-0" />
          {verdict.label}
        </span>
      </div>

      {review.pullRequestUrl && (
        <a
          href={review.pullRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-cyan-300 transition hover:text-cyan-200"
        >
          レビュー対象 PR を開く →
        </a>
      )}

      {review.concerns.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            懸念点
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-100 marker:text-amber-400/70">
            {review.concerns.map((concern, i) => (
              <li key={i}>{concern}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 生ログ引用は既定折りたたみ＋種別レーン（タスク E8-D・ImpactPanel と同じ畳み方）。 */}
      <CitationChips heading="判定根拠（引用）" citations={review.citations} />
    </section>
  );
}
