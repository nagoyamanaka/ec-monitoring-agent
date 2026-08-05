import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { ClockIcon, ShieldIcon } from "@shared/ui/icons";
import {
  citationKindCount,
  pastIncidentCount,
  riskSubjectLabel,
} from "../../domain/ForecastView";
import type { RiskCardView } from "../../domain/ForecastView";
import { riskLevelLabel } from "../../domain/RiskLevel";
import { CitationList } from "./CitationList";
import { ConvergenceMiniFlow } from "./ConvergenceMiniFlow";
import { ForecastTimeline } from "./ForecastTimeline";

/**
 * 予兆リスク1件のカード（step6 F7）: 「いつ危ないか」が予報の答えなので **window を主見出し**、
 * subject は補足行に置く（horizon「今週末」はページ側のメタ情報）。level 色は SeverityBadge
 * （HIGH/MEDIUM/LOW 転用）が担い、根拠の種類数（収束の強さ）を level の隣にチップで示す。
 * subject は表示時のみ人間語化（E9・riskSubjectLabel）し、生の突合キーは tooltip へ降格する
 * （引用チップの <details> メタ行が生IDの本文を担うため、カード面から機械語を消せる）。
 */
export interface RiskCardProps {
  risk: RiskCardView;
  /** 予報の発行時刻（時間軸の左端）。無ければ軸を出さない＝カードは従来どおり成立する。 */
  generatedAt?: string;
}

export function RiskCard({ risk, generatedAt }: RiskCardProps) {
  const kindCount = citationKindCount(risk.citations);
  const pastCount = pastIncidentCount(risk.citations);
  const subjectLabel = riskSubjectLabel(risk.subject);
  return (
    <article
      className="space-y-3 rounded-lg bg-slate-800/40 p-5"
      aria-label={`${riskLevelLabel(risk.level)}: ${subjectLabel}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-1.5 text-lg font-bold text-slate-50">
            <ClockIcon className="shrink-0 text-slate-400" />
            {risk.window}
          </h3>
          <p
            className="text-sm font-medium text-slate-300"
            {...(subjectLabel !== risk.subject ? { title: risk.subject } : {})}
          >
            {subjectLabel}
          </p>
        </div>
        {/* 確信度%は出さない。予報の confidence は LLM の**自己申告をクランプしただけ**で、
            診断側（ConfidenceCalibration＝検証可能な裏付けで cap を決め、署名UIで内訳を開く）
            のような担保が無い。しかも判断材料は level と同じ「独立した種類の根拠がどれだけ
            重なったか」なので、**その軸は既に「根拠 N種類」が決定論で出している**（citations の
            kind を数えた値＝盛る経路が無い）。未較正の％を大書きするのは「母数を隠した％を
            大きく出さない」という自分の規律への違反でもある。→ 値は wire と履歴には残す
            （LLM が何と言ったかの記録・同 level 内の表示順の tiebreak）が、画面には出さない。 */}
        <div className="flex shrink-0 items-center gap-2">
          {kindCount >= 2 && (
            <span
              className="rounded-full bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium text-slate-300"
              title="独立した種類の根拠（変更予定・負荷予定・過去の記憶）が重なるほどリスクの裏付けが強い"
            >
              根拠 {kindCount}種類
            </span>
          )}
          <SeverityBadge level={risk.level} />
        </div>
      </div>
      {/* 「いつ危ないか」の直下に「いつまでに動くか」を置く。window（見出し）だけだと
          対処を始める期限が画面のどこにも無く、時間の話が読み手の暗算に残っていた。
          引用にスケジュールが無ければ軸ごと出ない（縮退）。 */}
      {generatedAt && <ForecastTimeline risk={risk} generatedAt={generatedAt} />}
      <p className="text-sm leading-relaxed text-slate-300">{risk.reasoning}</p>
      {/* U1③: 収束ミニフロー＝「入力（根拠の種類別件数）→ AI 調査 → 結論」。
          カードは「入力→AI推論→結論→先手」の順で読ませたいので先手ブロックの直前に置く。 */}
      <ConvergenceMiniFlow risk={risk} />
      {/* F11a: 先手＝カード内の視覚的主役。実行主体は人間（write-zero）＝ボタンにしない。
          実行先（PR/plan/過去事例）への動線は下の CitationList の実リンクが担う。
          LLM が出さなければフィールドごと欠落＝このブロックが消えるだけの縮退。 */}
      {risk.preventiveAction && (
        <div className="rounded-lg bg-cyan-500/10 px-4 py-3">
          <p className="flex flex-wrap items-center justify-between gap-x-3 text-[11px] font-medium tracking-wide text-cyan-300">
            <span className="inline-flex items-center gap-1">
              <ShieldIcon className="shrink-0" />
              今打てる先手
            </span>
            <span className="font-normal text-slate-400">
              実行先は下の引用リンクから
            </span>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-cyan-100">
            {risk.preventiveAction}
          </p>
          {/* U1③: 先手の効果1行（決定論テンプレ・引用の past 件数から生成）。
              ②b の LLM 文（preventiveAction）を上書きせず別行で共存する（0件なら出さない）。 */}
          {pastCount > 0 && (
            <p className="mt-2 border-t border-cyan-500/20 pt-2 text-xs leading-relaxed text-cyan-200/80">
              この先手で、過去の同型事例（{pastCount}件）と同じ経路の再発を高負荷窓の外へ外します。
            </p>
          )}
        </div>
      )}
      <CitationList citations={risk.citations} />
    </article>
  );
}
