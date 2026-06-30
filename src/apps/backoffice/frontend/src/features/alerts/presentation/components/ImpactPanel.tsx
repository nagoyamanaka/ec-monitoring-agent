import type { ImpactView, ImpactFault } from "../../domain/InvestigationReportView";

export interface ImpactPanelProps {
  impact: ImpactView;
}

/** 自責他責ラベルの表示用ラベル＋配色。unknown は証拠不足＝中立色。 */
const FAULT_STYLE: Record<ImpactFault, { label: string; className: string }> = {
  own: {
    label: "自責（自社コード/IaC 起因）",
    className: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  },
  external: {
    label: "他責（外部API/ベンダー起因）",
    className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  unknown: {
    label: "断定不能（証拠不足）",
    className: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  },
};

/**
 * 影響評価パネル（報告用フル・詳細ページのみ）。
 * 自責他責・影響範囲・障害規模・影響主体・算定根拠（citations チップ）を全表示する（タスク34/37）。
 * 一覧オーバレイは `impact.scale` のみを要約に出すため、本パネルは使わない。
 */
export function ImpactPanel({ impact }: ImpactPanelProps) {
  const fault = FAULT_STYLE[impact.fault];
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          影響評価
        </h4>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${fault.className}`}
        >
          {fault.label}
        </span>
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            影響範囲
          </dt>
          <dd className="text-slate-100">{impact.scope}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            障害規模
          </dt>
          <dd className="text-slate-100">{impact.scale}</dd>
        </div>
      </dl>

      {impact.affectedSubjects.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            影響を受けた主体
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {impact.affectedSubjects.map((subject, i) => (
              <li
                key={i}
                className="rounded-md bg-slate-800/60 px-2 py-0.5 text-xs text-slate-200 ring-1 ring-inset ring-slate-700/60"
              >
                {subject}
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.citations.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            算定根拠（引用）
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {impact.citations.map((citation, i) => (
              <li
                key={i}
                className="rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-300 ring-1 ring-inset ring-slate-700/60"
              >
                {citation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
