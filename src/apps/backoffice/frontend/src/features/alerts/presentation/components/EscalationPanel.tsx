import type { EscalationView } from "../../domain/InvestigationReportView";
import { CitationChips } from "./CitationChips";

export interface EscalationPanelProps {
  escalation: EscalationView;
}

/**
 * エスカレーション草案パネル（報告用フル・詳細ページのみ）。
 * 他責/運用案件のとき RunbookEscalationAgent が起案した宛先・理由・重大度根拠・添付証拠を表示する
 * （タスク35/37）。暫定回避手順は結論直後の「次のアクション」（NextActionCard・U6）へ昇格済みで、
 * この草案は「誰に渡すか」に徹する。起案までで送信・起票はしない（人間承認の前段）。
 */
export function EscalationPanel({ escalation }: EscalationPanelProps) {
  return (
    <section className="space-y-2 rounded-md bg-amber-500/5 p-3 ring-1 ring-inset ring-amber-500/20">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-200">
          エスカレーション草案
        </h4>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
          人間承認の前段（送信はしない）
        </span>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          宛先チーム
        </dt>
        <dd className="text-slate-100">{escalation.team}</dd>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          担当者
        </dt>
        <dd className="text-slate-100">{escalation.owner}</dd>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          連絡先
        </dt>
        <dd className="text-slate-100">{escalation.contact}</dd>
      </dl>

      <div className="space-y-1.5 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            理由
          </span>
          <p className="text-slate-100">{escalation.reason}</p>
        </div>
        {/* 暫定回避手順（interimWorkaround）は結論直後の「次のアクション」（NextActionCard）へ
            昇格したのでここでは繰り返さない。この草案は「誰に渡すか」の従属情報に徹する。 */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            重大度の根拠
          </span>
          <p className="text-slate-100">{escalation.severityRationale}</p>
        </div>
      </div>

      {/* 生ログ引用は既定折りたたみ＋種別レーン（タスク E8-D・ImpactPanel と同じ畳み方）。 */}
      <CitationChips
        heading="添付証拠"
        citations={escalation.evidenceBundle}
        refs={escalation.evidenceBundleRefs}
      />
    </section>
  );
}
