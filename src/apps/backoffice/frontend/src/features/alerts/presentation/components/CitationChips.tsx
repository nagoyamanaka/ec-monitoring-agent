import { useState } from "react";
import { cn } from "@shared/ui/cn";
import { groupCitations } from "../../domain/citationGroups";

export interface CitationChipsProps {
  /** 折りたたみトグルの見出し（例: 「算定根拠（引用）」「添付証拠」）。 */
  heading: string;
  citations: readonly string[];
}

/**
 * 引用チップの折りたたみ＋ソース種別レーン（タスク E8-D）。
 * 生ログ引用の羅列は正直さの担保として必須だが「読ませる密度」ではないため、
 * 既定は「{heading} n件」だけを見せ（＝根拠があることは一目）、展開時に
 * 観測データ／変更履歴／過去事例のレーン（左ボーダー色）でグルーピングして出す。
 */
export function CitationChips({ heading, citations }: CitationChipsProps) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  const groups = groupCitations(citations);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((cur) => !cur)}
        className="flex items-center gap-1.5 rounded text-[11px] font-medium uppercase tracking-wide text-slate-400 transition hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        <span
          aria-hidden
          className={cn("text-[10px] transition-transform", open && "rotate-90")}
        >
          ▶
        </span>
        {heading}
        <span className="rounded bg-slate-800/70 px-1.5 py-0.5 font-semibold normal-case tracking-normal text-slate-300 ring-1 ring-inset ring-slate-700/60">
          {citations.length}件
        </span>
      </button>

      {open && (
        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.key}
              className={cn("space-y-1 border-l-2 pl-2.5", group.borderClass)}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((citation, i) => (
                  <li
                    key={i}
                    className="break-all rounded bg-slate-800/70 px-2 py-1 font-mono text-[11px] leading-relaxed text-slate-300 ring-1 ring-inset ring-slate-700/60"
                  >
                    {citation}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
