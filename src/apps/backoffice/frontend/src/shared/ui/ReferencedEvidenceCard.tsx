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

/** 分類タグは Tier3（顕著性設計）: 色相は面（tint 背景）だけに残し、文字は中立 slate。
 *  彩色文字は深刻度/先手/リンクの Tier1-2 専用＝チップが本文と輝度で張り合わない。 */
const CHIP_CLASS: Record<ReferencedChipTone, string> = {
  cyan: "rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-200",
  emerald:
    "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-200",
  amber:
    "rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-200",
};

// L10: クリック可能な中立サーフェスの hover 規約＝「面を上げる」（bg を1段明るく）で統一。
// border/ring の変化は focus-visible と selected/active 状態専用に予約（G2「線でなく面で分ける」の hover 版）。
const ROW_CLASS =
  "block w-full rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-2.5 text-left transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";

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
  description?: string;
  /** 生ID等の補足メタ行（font-mono・最小主張）。人間語の title/description の下に小さく出す。 */
  meta?: string;
  /** リンクフッターのラベル。既定「詳細を開く」。 */
  linkLabel?: string;
  /** SPA 内リンク先（例: /alerts/:id）。onClick/href より優先度は onClick > to > href。 */
  to?: string;
  /** 外部リンク先（例: PR html_url）。別タブで開く。 */
  href?: string;
  /** クリックで舞台に留まって選択を差し替える用途（RelatedAlertsPanel の onNavigate）。 */
  onClick?: () => void;
  /**
   * コンパクト表示（U1②a・引用チップの縦長解消）。
   * chip＋title＋リンクを **1行** に畳む。生ID等の補足は `details` に隠す（下記）。
   */
  compact?: boolean;
  /**
   * 折り畳み（<details>）に格納する補足（生ID・生 subject 等の最小主張メタ）。
   * compact のときだけ有効＝クリック本体（link）とは別の開閉として並べる（対話要素のネスト回避）。
   */
  details?: ReactNode;
}

/** link/button/anchor/div のいずれかで content を包む（優先度 onClick > to > href > 非操作）。 */
function Clickable({
  to,
  href,
  onClick,
  className,
  children,
}: Pick<ReferencedEvidenceCardProps, "to" | "href" | "onClick"> & {
  className: string;
  children: ReactNode;
}) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    );
  }
  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

function CardBody({
  chipLabel,
  chipTone,
  severity,
  timestamp,
  title,
  description,
  meta,
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
      {description && (
        <p className="mt-1 text-xs leading-snug text-slate-300">{description}</p>
      )}
      {meta && (
        <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
          {meta}
        </p>
      )}
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
  const { to, href, onClick, compact, details } = props;
  const hasLink = Boolean(onClick || to || href);

  if (compact) {
    return (
      <div className="rounded-md border border-slate-700/60 bg-slate-800/30 transition focus-within:border-cyan-500/40 hover:bg-slate-800/60">
        <Clickable
          to={to}
          href={href}
          onClick={onClick}
          className="block w-full px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {/* 1行目: チップ＋タイトル（全幅で折り返し・truncate しない＝全文を隠さず読ませる）。 */}
          <div className="flex items-start gap-2">
            <span className={cn("mt-0.5 shrink-0", CHIP_CLASS[props.chipTone])}>
              {props.chipLabel}
            </span>
            {props.severity && <SeverityBadge level={props.severity} />}
            {props.title && (
              <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-100">
                {props.title}
              </span>
            )}
          </div>
          {/* 2行目: 時刻（長文になりがち）と「証拠を開く」を降ろし、タイトルの幅を奪わせない。 */}
          {(props.timestamp || hasLink) && (
            <div className="mt-1 flex items-center gap-2">
              {props.timestamp && (
                <span className="text-[11px] text-slate-400">
                  {props.timestamp}
                </span>
              )}
              {hasLink && (
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-cyan-300">
                  <LinkIcon className="shrink-0" />
                  {props.linkLabel ?? "詳細を開く"}
                </span>
              )}
            </div>
          )}
        </Clickable>
        {details && (
          <details className="border-t border-slate-700/40 px-3 py-1.5">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300">
              詳細
            </summary>
            <div className="mt-1.5">{details}</div>
          </details>
        )}
      </div>
    );
  }

  const body: ReactNode = <CardBody {...props} hasLink={hasLink} />;
  return (
    <Clickable
      to={to}
      href={href}
      onClick={onClick}
      className={hasLink ? ROW_CLASS : cn(STATIC_ROW_CLASS)}
    >
      {body}
    </Clickable>
  );
}
