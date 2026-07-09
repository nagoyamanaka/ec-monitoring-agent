import { ShieldIcon } from "@shared/ui/icons";
import { InvestigationItem } from "./InvestigationItem";
import type { NextActionView } from "../../domain/nextAction";

export interface NextActionCardProps {
  next: NextActionView;
}

/** 供給源ごとの正直なラベルと補足（どこから来た「次のアクション」かを明示する）。 */
function metaOf(next: NextActionView): { badge: string; footnote: string | null } {
  switch (next.origin) {
    case "remediation":
      // 「コードで修正可能」の実行導線は下の「自動修正」パネル（シナリオ4）が自明に担うので
      // footnote での案内はしない（冗長・自動修正が無いルートでは的外れになる）。
      return {
        badge: next.remediable ? "コードで修正可能（AI 判定）" : "自社で対応",
        footnote: null,
      };
    case "escalation":
      return {
        badge: "一次対応（外部要因）",
        footnote:
          "恒久対応は下の「エスカレーション草案」の宛先チームへ引き継ぎます。",
      };
    case "memory":
      return {
        badge: "前回の対応をなぞる（既知/類似）",
        footnote:
          "AI 調査を起動せず、過去の同型事例と同じ対応を提示しています。詳細は下の履歴から確認できます。",
      };
  }
}

/**
 * 対応フェーズの「次のアクション」ブロック。予兆の「今打てる先手」と対の視覚言語（cyan・盾）で、
 * 「何が起きた → 次にこれをやる → 誰に渡す」の読み順を作る＝結論の直後に置く。全ルート共通の顔にし、
 * 自責＝手順リスト（リンク付き）／他責・既知＝単文で本文だけ出し分ける。
 * 実行主体は人間（write-zero）なのでボタンにはしない（自動修正は別パネル＝シナリオ4が担う）。
 */
export function NextActionCard({ next }: NextActionCardProps) {
  const meta = metaOf(next);
  return (
    <section className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
      <p className="flex flex-wrap items-center justify-between gap-x-3 text-[11px] font-semibold uppercase tracking-wide text-cyan-300">
        <span className="inline-flex items-center gap-1">
          <ShieldIcon className="shrink-0" />
          次のアクション
        </span>
        <span className="font-normal normal-case text-slate-400">
          {meta.badge}
        </span>
      </p>
      {next.origin === "remediation" ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-cyan-100 marker:text-cyan-500/70">
          {next.steps.map((step, i) => (
            <li key={i}>
              <InvestigationItem item={step} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-cyan-100">
          {next.text}
        </p>
      )}
      {meta.footnote && (
        <p className="mt-2 border-t border-cyan-500/20 pt-2 text-[11px] leading-relaxed text-cyan-200/80">
          {meta.footnote}
        </p>
      )}
    </section>
  );
}
