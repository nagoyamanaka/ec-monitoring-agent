import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "./cn";
import { LinkIcon } from "./icons";
import { SeverityBadge, type SeverityLevel } from "./SeverityBadge";

/**
 * 「id＋ラベル＋根拠」を実在レコードへ解決して提示する参照カード（step6 F7 で昇格）。
 * 消費者は2つ:
 *  - RelatedAlertsPanel（AI 相関・過去の同型事例 → アラートへのリンク）
 *  - CitationList（予兆リスクの引用チップ → PR/スケジュール/過去アラートへのリンク）
 * 両者は「LLM が出した参照を防御的に検証してから実在の証拠へ張る」同型パターン（タスク9e/F7）。
 * shared は features を import できないため、解決（resolver）は各 feature の domain に残し、
 * 本コンポーネントは解決済みの表示素材（純 props）だけを受け取る。
 */

/** チップ色。cyan=進行中の相関/変更、emerald=過去事例（既知・類似度ゲージと同系色）、amber=時限。 */
export type ReferencedChipTone = "cyan" | "emerald" | "amber";

const CHIP_CLASS: Record<ReferencedChipTone, string> = {
  cyan: "rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30",
  emerald:
    "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  amber:
    "rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30",
};

const ROW_CLASS =
  "block w-full rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-2.5 text-left transition hover:border-cyan-500/40 hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";

/** リンク無し（参照先へ飛べない参照）用。hover 反応を消して非操作を示す。 */
const STATIC_ROW_CLASS =
  "block w-full rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-2.5 text-left";

export interface ReferencedEvidenceCardProps {
  /** 参照の種別チップ（例: 「同一根本原因」「類似 67%」「未来の変更」）。 */
  chipLabel: string;
  chipTone: ReferencedChipTone;
  /** 解決済みのときの severity バッジ（任意）。 */
  severity?: SeverityLevel;
  /** 右上に出す整形済みの時刻/時間帯テキスト（任意）。 */
  timestamp?: string;
  /** 解決済みタイトル（人間語）。null/未指定なら本文のみ。 */
  title?: string | null;
  /** 根拠・説明文。 */
  description: string;
  /** リンクフッターのラベル。既定「詳細を開く」。 */
  linkLabel?: string;
  /** SPA 内リンク先（例: /alerts/:id）。onClick/href より優先度は onClick > to > href。 */
  to?: string;
  /** 外部リンク先（例: PR html_url）。別タブで開く。 */
  href?: string;
  /** クリックで舞台に留まって選択を差し替える用途（RelatedAlertsPanel の onNavigate）。 */
  onClick?: () => void;
}

function CardBody({
  chipLabel,
  chipTone,
  severity,
  timestamp,
  title,
  description,
  linkLabel,
  hasLink,
}: ReferencedEvidenceCardProps & { hasLink: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className={CHIP_CLASS[chipTone]}>{chipLabel}</span>
        {severity && <SeverityBadge level={severity} />}
        {timestamp && (
          <span className="ml-auto text-[11px] text-slate-400">{timestamp}</span>
        )}
      </div>
      {title && (
        <p className="mt-1.5 truncate text-sm font-medium text-slate-100">
          {title}
        </p>
      )}
      <p className="mt-1 text-xs leading-snug text-slate-300">{description}</p>
      {hasLink && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-cyan-300">
          <LinkIcon className="shrink-0" />
          {linkLabel ?? "詳細を開く"}
        </span>
      )}
    </>
  );
}

export function ReferencedEvidenceCard(props: ReferencedEvidenceCardProps) {
  const { to, href, onClick } = props;
  const body: ReactNode = (
    <CardBody {...props} hasLink={Boolean(onClick || to || href)} />
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={ROW_CLASS}>
        {body}
      </button>
    );
  }
  if (to) {
    return (
      <Link to={to} className={ROW_CLASS}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={ROW_CLASS}>
        {body}
      </a>
    );
  }
  return <div className={cn(STATIC_ROW_CLASS)}>{body}</div>;
}
