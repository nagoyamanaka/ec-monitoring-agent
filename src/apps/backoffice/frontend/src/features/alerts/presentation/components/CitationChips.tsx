import { useState } from "react";
import { cn } from "@shared/ui/cn";
import {
  groupCitations,
  groupCitationRefs,
  countVerified,
  CITATION_KIND_LABEL,
} from "../../domain/citationGroups";
import type { CitationRefView } from "../../domain/InvestigationReportView";

export interface CitationChipsProps {
  /** 折りたたみトグルの見出し（例: 「算定根拠（引用）」「添付証拠」）。 */
  heading: string;
  citations: readonly string[];
  /**
   * citations の実在照合結果（backend が証拠カタログと突合した事実・1:1 対応）。
   * あれば「[出所ラベル] 値 ✓照合済み」の解決済みチップ＋ヘッダに照合サマリを出し、
   * 無ければ（旧データ）従来のプレフィックス推測グルーピングにフォールバックする。
   */
  refs?: readonly CitationRefView[];
}

/**
 * 引用チップの折りたたみ＋ソース種別レーン（タスク E8-D）。
 * 生ログ引用の羅列は正直さの担保として必須だが「読ませる密度」ではないため、
 * 既定は「{heading} n件」だけを見せ（＝根拠があることは一目）、展開時に
 * 観測データ／変更履歴／過去事例のレーン（左ボーダー色）でグルーピングして出す。
 *
 * refs があるときはさらに、各引用が「収集済み証拠のどのフィールドに解決したか」
 * （受信イベント名／コミット等のラベル）と実在照合の結果（✓照合済み／未照合）を
 * チップに載せる＝引用が捏造でないことを機構で示す可視化。未照合も隠さず出す。
 */
export function CitationChips({ heading, citations, refs }: CitationChipsProps) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  const resolved = refs && refs.length > 0 ? refs : undefined;
  const verifiedCount = resolved ? countVerified(resolved) : 0;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((cur) => !cur)}
        className="flex items-center gap-1.5 rounded-md text-[11px] font-medium uppercase tracking-wide text-slate-400 transition hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        <span
          aria-hidden
          className={cn("text-[10px] transition-transform", open && "rotate-90")}
        >
          ▶
        </span>
        {heading}
        <span className="rounded-md bg-slate-800/70 px-1.5 py-0.5 font-medium normal-case tracking-normal text-slate-300">
          {citations.length}件
        </span>
        {/* 照合サマリは畳んだままでも見える＝「引用は実在確認済み」が一目で伝わる。 */}
        {resolved && verifiedCount > 0 && (
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium normal-case tracking-normal text-emerald-300">
            ✓ {verifiedCount}/{resolved.length} 実在照合済み
          </span>
        )}
      </button>

      {open &&
        (resolved ? (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-slate-400">
              各引用は収集済み証拠カタログと自動突合しています（✓＝実在を確認済み・未照合も隠さず表示）。
            </p>
            {groupCitationRefs(resolved).map((group) => (
              <div
                key={group.key}
                className={cn("space-y-1 border-l-2 pl-2.5", group.borderClass)}
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((ref, i) => (
                    <CitationRefChip key={i} citation={ref} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {groupCitations(citations).map((group) => (
              <div
                key={group.key}
                className={cn("space-y-1 border-l-2 pl-2.5", group.borderClass)}
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((citation, i) => (
                    <li
                      key={i}
                      className="break-all rounded-md bg-slate-800/70 px-2 py-1 font-mono text-[11px] leading-relaxed text-slate-300"
                    >
                      {citation}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

/** 解決済み引用1件のチップ: [出所ラベル] 値（リンク解決時はクリック可） ✓照合済み/未照合。 */
function CitationRefChip({ citation }: { citation: CitationRefView }) {
  const verified = citation.kind !== undefined;
  return (
    <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md bg-slate-800/70 px-2 py-1">
      {verified && (
        <span className="shrink-0 rounded-md bg-slate-700/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
          {CITATION_KIND_LABEL[citation.kind!]}
        </span>
      )}
      {citation.href ? (
        // 相対 href＝backoffice SPA の内部ルート（相関アラート等）は同タブ遷移、外部 URL は別タブ。
        <a
          href={citation.href}
          {...(citation.href.startsWith("http")
            ? { target: "_blank", rel: "noreferrer" }
            : {})}
          className="break-all font-mono text-[11px] leading-relaxed text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200"
        >
          {citation.value}
        </a>
      ) : (
        <span className="break-all font-mono text-[11px] leading-relaxed text-slate-200">
          {citation.value}
        </span>
      )}
      {verified ? (
        <span className="ml-auto shrink-0 text-[10px] font-medium text-emerald-300">
          ✓ 照合済み
        </span>
      ) : (
        <span className="ml-auto shrink-0 text-[10px] font-medium text-slate-400">
          未照合
        </span>
      )}
    </li>
  );
}
