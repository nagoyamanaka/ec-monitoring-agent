import {
  ReferencedEvidenceCard,
  type ReferencedChipTone,
} from "@shared/ui/ReferencedEvidenceCard";
import { groupCitationsByKind, type CitationView } from "../../domain/ForecastView";

/**
 * リスクの引用チップ（step6 F7・本機能の体験の肝）。
 * ここに並ぶのは backend の2段検証（偽引用破棄・裏付けゼロのリスク破棄）を通過した
 * **実在シグナルのみ**＝「AI の予報に根拠が張られている／ハルシネーションは表示前に落ちる」
 * ことの可視化。カード描画は RelatedAlertsPanel と共有の ReferencedEvidenceCard（同型パターン）。
 *
 * 表示は種別レーン（変更予定 cyan / 負荷予定 amber / 過去の記憶 emerald）にグルーピングし、
 * 「n系統」チップで収束の強さを示す＝独立した系統が重なるほど格上げされる予報ロジックを
 * そのまま画面構造で語る（groupCitationsByKind のコメント参照・タイムチャート不採用の代替）。
 */

/** 種別の塗り分け: 未来の変更=cyan（進行中）/ スケジュール=amber（時限）/ 過去事例=emerald（既知系）。 */
const KIND_TONES: Record<string, ReferencedChipTone> = {
  FUTURE_CHANGE: "cyan",
  SCHEDULE: "amber",
  MEMORY: "emerald",
};

/** レーン左ボーダー色（チップ色と同系＝レーンと種別チップが同じ軸だと分かる）。 */
const LANE_BORDERS: Record<string, string> = {
  FUTURE_CHANGE: "border-cyan-500/40",
  SCHEDULE: "border-amber-500/40",
  MEMORY: "border-emerald-500/40",
};

function citationTone(kind: string): ReferencedChipTone {
  return KIND_TONES[kind] ?? "cyan";
}

export interface CitationListProps {
  citations: readonly CitationView[];
}

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) return null;
  const lanes = groupCitationsByKind(citations);
  return (
    <section className="space-y-2" aria-label="引用">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          根拠（引用）
        </h4>
        <span className="rounded-full bg-slate-700/40 px-1.5 text-[11px] font-medium text-slate-300">
          {lanes.length}系統・{citations.length}件
        </span>
        <span className="text-[11px] text-slate-400">
          実在シグナルと照合済み＝裏付けの無い推定は表示前に破棄されます
        </span>
      </div>
      <div className="space-y-2">
        {lanes.map((lane) => (
          <div
            key={lane.kind}
            className={`space-y-2 border-l-2 pl-3 ${LANE_BORDERS[lane.kind] ?? "border-slate-600/50"}`}
          >
            {lane.citations.map((c) => (
              <ReferencedEvidenceCard
                key={c.id}
                chipLabel={c.kindLabel}
                chipTone={citationTone(c.kind)}
                timestamp={c.when}
                title={c.desc}
                // 先頭にシグナル id（pr-55 等）＝reasoning 本文・コンソール台帳と同一 ID で照合できる
                meta={`${c.id} · ${c.subject}`}
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
        ))}
      </div>
    </section>
  );
}
