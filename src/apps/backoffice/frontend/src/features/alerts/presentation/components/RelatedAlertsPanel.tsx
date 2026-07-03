import { cn } from "@shared/ui/cn";
import {
  ReferencedEvidenceCard,
  type ReferencedChipTone,
} from "@shared/ui/ReferencedEvidenceCard";
import { formatDateTimeJa } from "@shared/format/dateTime";
import type { AlertView } from "../../domain/AlertView";
import { eventTitle } from "../../domain/eventCatalog";
import {
  collectCorrelatedRefs,
  collectPastIncidentRefs,
  toRelatedAlertViews,
  toPastIncidentViews,
} from "../../domain/relatedAlerts";

export interface RelatedAlertsPanelProps {
  /** 表示対象アラート。AI 相関＋分類 back-link＋完全一致の過去事例を集約する。 */
  alert: AlertView;
  /**
   * alertId → 一覧の AlertView 解決関数（任意）。
   * 渡されると関連先の日時/severity/タイトルを補完する。無い・未解決でもリンクは出す。
   */
  lookup?: (id: string) => AlertView | undefined;
  /**
   * 一覧のアラート集合（任意）。完全一致（EXACT_MATCH）分類のとき、同 eventName の
   * 対処済み過去アラートをここから引いて「過去の同型事例」に出す。
   */
  alerts?: readonly AlertView[];
  /**
   * 関連アラートを開くハンドラ（任意）。渡されると行はルート遷移せず本関数で選択を差し替える
   * ＝デモの舞台に留まったまま辿れる。無ければ `/alerts/:id` への `Link`（従来）にフォールバック。
   */
  onNavigate?: (id: string) => void;
  className?: string;
}

/** 関連/過去の両行が共有する表示形。ラベルとチップ色だけが違う。 */
type LinkedAlertRow = {
  readonly alertId: string;
  readonly chipLabel: string;
  readonly chipTone: ReferencedChipTone;
  readonly rationale: string;
  readonly resolved: boolean;
  readonly title?: string;
  readonly severity?: AlertView["severity"];
  readonly occurredOn?: string;
};

function AlertRow({
  row,
  onNavigate,
}: {
  row: LinkedAlertRow;
  onNavigate?: (id: string) => void;
}) {
  // onNavigate あり＝舞台に留まって選択差し替え（button）。無ければ詳細ページへの Link。
  return (
    <ReferencedEvidenceCard
      chipLabel={row.chipLabel}
      chipTone={row.chipTone}
      severity={row.resolved ? row.severity : undefined}
      timestamp={
        row.resolved && row.occurredOn
          ? formatDateTimeJa(row.occurredOn)
          : undefined
      }
      title={row.resolved && row.title ? eventTitle(row.title) : null}
      description={row.rationale}
      onClick={onNavigate ? () => onNavigate(row.alertId) : undefined}
      to={
        onNavigate ? undefined : `/alerts/${encodeURIComponent(row.alertId)}`
      }
    />
  );
}

function RowSection({
  label,
  description,
  rows,
  onNavigate,
}: {
  label: string;
  description: string;
  rows: LinkedAlertRow[];
  onNavigate?: (id: string) => void;
}) {
  return (
    <section className="space-y-2" aria-label={label}>
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {label}
        </h4>
        <span className="rounded-full bg-slate-700/40 px-1.5 text-[11px] font-medium text-slate-300">
          {rows.length}
        </span>
      </div>
      <p className="text-[11px] text-slate-400">{description}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <AlertRow key={row.alertId} row={row} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

/**
 * 関連アラート＋過去の同型事例（タスク9e）。意図の違う2カテゴリに分けて出す:
 *  - 関連アラート: AI 調査が見つけた、今並行して起きている相関（トリアージ＝他にどこが燃えているか）。
 *  - 過去の同型事例: 解決/承認済みの再発元（解決ショートカット＝前回どう直したか）。
 *    完全一致は「一致」、類似は「類似 N%」の確度チップで段階表示する。
 * どちらも無ければ何も描画しない。
 */
export function RelatedAlertsPanel({
  alert,
  lookup,
  alerts,
  onNavigate,
  className,
}: RelatedAlertsPanelProps) {
  const resolve = lookup ?? (() => undefined);
  const correlated = toRelatedAlertViews(collectCorrelatedRefs(alert), resolve);
  const past = toPastIncidentViews(
    collectPastIncidentRefs(alert, alerts ?? []),
    resolve,
  );
  if (correlated.length === 0 && past.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {correlated.length > 0 && (
        <RowSection
          label="関連アラート"
          description="AI 調査が見つけた、根本原因や波及を共有する進行中の別アラートです。"
          rows={correlated.map((r) => ({
            alertId: r.alertId,
            chipLabel: r.relationLabel,
            chipTone: "cyan" as const,
            rationale: r.rationale,
            resolved: r.resolved,
            title: r.title,
            severity: r.severity,
            occurredOn: r.occurredOn,
          }))}
          onNavigate={onNavigate}
        />
      )}
      {past.length > 0 && (
        <RowSection
          label="過去の同型事例"
          description="同じ/類似パターンとして過去に対処済みのアラートです。当時の対応が参考になります。"
          rows={past.map((r) => ({
            alertId: r.alertId,
            chipLabel: r.matchLabel,
            chipTone: "emerald" as const,
            rationale: r.rationale,
            resolved: r.resolved,
            title: r.title,
            severity: r.severity,
            occurredOn: r.occurredOn,
          }))}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
