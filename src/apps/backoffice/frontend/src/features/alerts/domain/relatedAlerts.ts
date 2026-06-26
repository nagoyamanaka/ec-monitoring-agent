import type { AlertView, AlertSeverity } from "./AlertView";
import type { RelatedAlertRef } from "./InvestigationReportView";

/**
 * 相関アラート（タスク9e）の表示用ドメイン。型＋純関数のみ。
 *
 * 出所は2つを統合する:
 *  - AI 相関（`report.relatedAlerts`）= 異なるアラート間の関係（同一根本原因・波及など）。
 *  - 類似既知の back-link（SIMILARITY 分類の `sourceAlertId`・タスク9b）= 過去の同型障害。
 * いずれも検知層の dedup（同一 dedupKey の畳み込み）とは別軸。
 *
 * alertId から日時/severity/タイトルを解決するため、表示時に alerts 一覧の lookup を受け取る。
 * 解決できない（一覧に無い）場合もリンク＋関係ラベル＋根拠は出す（degrade）。
 */

export type { RelatedAlertRef };

/** 関係種別の人間語ラベル。LLM は既知コードを返す想定だが、未知文字列はそのまま表示。 */
const RELATION_LABELS: Record<string, string> = {
  same_root_cause: "同一根本原因",
  downstream: "波及（下流）",
  upstream: "起因（上流）",
  precursor: "予兆",
  similar: "同型",
};

export function relationLabel(relation: string): string {
  return RELATION_LABELS[relation] ?? relation;
}

/** 解決済み同型 Alert（SIMILARITY back-link）を表す合成 relation コード。 */
export const SIMILAR_RELATION = "similar";

export type RelatedAlertView = {
  readonly alertId: string;
  readonly relation: string;
  readonly relationLabel: string;
  readonly rationale: string;
  /** 一覧から解決できたか（解決時のみ title/severity/occurredOn を持つ）。 */
  readonly resolved: boolean;
  readonly title?: string;
  readonly severity?: AlertSeverity;
  readonly occurredOn?: string;
};

/**
 * Alert から相関参照を集約する。AI 相関（report.relatedAlerts）と SIMILARITY back-link を
 * 統合し、自分自身・重複 alertId は除外する（先勝ち＝AI 相関を優先）。
 */
export function collectRelatedRefs(alert: AlertView): RelatedAlertRef[] {
  const refs: RelatedAlertRef[] = [...(alert.report?.relatedAlerts ?? [])];

  if (
    alert.classification.type === "known" &&
    alert.classification.source === "SIMILARITY" &&
    alert.classification.sourceAlertId
  ) {
    refs.push({
      alertId: alert.classification.sourceAlertId,
      relation: SIMILAR_RELATION,
      rationale: "過去に解決済みの同型障害。当時の対応が参考になります。",
    });
  }

  const seen = new Set<string>([alert.id]);
  return refs.filter((ref) => {
    if (seen.has(ref.alertId)) return false;
    seen.add(ref.alertId);
    return true;
  });
}

function toRelatedAlertView(
  ref: RelatedAlertRef,
  resolved: AlertView | undefined,
): RelatedAlertView {
  const base = {
    alertId: ref.alertId,
    relation: ref.relation,
    relationLabel: relationLabel(ref.relation),
    rationale: ref.rationale,
  };
  if (!resolved) return { ...base, resolved: false };
  return {
    ...base,
    resolved: true,
    title: resolved.eventName,
    severity: resolved.severity,
    occurredOn: resolved.occurredOn,
  };
}

/** 相関参照を、一覧 lookup で表示用 View へ解決する純関数。 */
export function toRelatedAlertViews(
  refs: readonly RelatedAlertRef[],
  lookup: (id: string) => AlertView | undefined,
): RelatedAlertView[] {
  return refs.map((ref) => toRelatedAlertView(ref, lookup(ref.alertId)));
}
