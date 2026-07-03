import {
  ReferencedEvidenceCard,
  type ReferencedChipTone,
} from "@shared/ui/ReferencedEvidenceCard";
import type { CitationView } from "../../domain/ForecastView";

/**
 * リスクの引用チップ（step6 F7・本機能の体験の肝）。
 * ここに並ぶのは backend の2段検証（偽引用破棄・裏付けゼロのリスク破棄）を通過した
 * **実在シグナルのみ**＝「AI の予報に根拠が張られている／ハルシネーションは表示前に落ちる」
 * ことの可視化。カード描画は RelatedAlertsPanel と共有の ReferencedEvidenceCard（同型パターン）。
 */

/** 種別の塗り分け: 未来の変更=cyan（進行中）/ スケジュール=amber（時限）/ 過去事例=emerald（既知系）。 */
const KIND_TONES: Record<string, ReferencedChipTone> = {
  FUTURE_CHANGE: "cyan",
  SCHEDULE: "amber",
  MEMORY: "emerald",
};

function citationTone(kind: string): ReferencedChipTone {
  return KIND_TONES[kind] ?? "cyan";
}

export interface CitationListProps {
  citations: readonly CitationView[];
}

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="引用">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          根拠（引用）
        </h4>
        <span className="rounded-full bg-slate-700/40 px-1.5 text-[11px] font-medium text-slate-300">
          {citations.length}
        </span>
        <span className="text-[11px] text-slate-400">
          実在シグナルと照合済み＝裏付けの無い推定は表示前に破棄されます
        </span>
      </div>
      <div className="space-y-2">
        {citations.map((c) => (
          <ReferencedEvidenceCard
            key={c.id}
            chipLabel={c.kindLabel}
            chipTone={citationTone(c.kind)}
            timestamp={c.when}
            title={c.subject}
            description={c.desc}
            to={
              c.alertId
                ? `/alerts/${encodeURIComponent(c.alertId)}`
                : undefined
            }
            href={c.alertId ? undefined : c.url}
            linkLabel={c.alertId ? "当時のアラートを開く" : "証拠を開く"}
          />
        ))}
      </div>
    </section>
  );
}
