import type { AlertView, AlertSeverity } from "./AlertView";
import type { RelatedAlertRef } from "./InvestigationReportView";

/**
 * 相関アラート（タスク9e）の表示用ドメイン。型＋純関数のみ。
 *
 * オーバーレイは利用者の意図が違う2カテゴリに分ける:
 *  - 関連アラート（collectCorrelatedRefs）= 今まさに並行して起きている相関
 *    （same_root_cause / downstream / upstream / precursor）。トリアージ用途＝「他にどこが燃えているか」。
 *  - 過去の同型事例（collectPastIncidentRefs）= 時間的に離れた解決/承認済みの再発元。
 *    解決ショートカット用途＝「前回どう直したか」。完全一致は「一致」、類似は「類似 N%」の
 *    確度チップで段階表示する（完全一致/類似/未知の3段スペクトルと整合）。
 * いずれも検知層の dedup（同一 dedupKey の畳み込み）とは別軸。
 *
 * alertId から日時/severity/タイトルを解決するため、表示時に alerts 一覧の lookup を受け取る。
 * 解決できない（一覧に無い）場合もリンク＋ラベル＋根拠は出す（degrade）。
 */

export type { RelatedAlertRef };

/** 関係種別の人間語ラベル。LLM は既知コードを返す想定だが、未知文字列はそのまま表示。 */
const RELATION_LABELS: Record<string, string> = {
  same_root_cause: "同一根本原因",
  downstream: "波及（下流）",
  upstream: "起因（上流）",
  precursor: "予兆",
};

export function relationLabel(relation: string): string {
  return RELATION_LABELS[relation] ?? relation;
}

/**
 * AI 相関のうち「過去の同型」を表す relation コード。同時発生の相関ではないため
 * 「関連アラート」ではなく「過去の同型事例」側に振り分ける。
 */
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
 * 「関連アラート」＝今並行して起きている相関だけを集約する（AI 相関のうち similar 以外）。
 * 自分自身・重複 alertId は除外する（先勝ち）。
 */
export function collectCorrelatedRefs(alert: AlertView): RelatedAlertRef[] {
  const refs = (alert.report?.relatedAlerts ?? []).filter(
    (ref) => ref.relation !== SIMILAR_RELATION,
  );

  const seen = new Set<string>([alert.id]);
  return refs.filter((ref) => {
    if (seen.has(ref.alertId)) return false;
    seen.add(ref.alertId);
    return true;
  });
}

/** 過去事例の一致度。exact=完全一致（同一パターン） / similar=類似（字句/ES 類似度）。 */
export type PastIncidentMatch = "exact" | "similar";

export type PastIncidentRef = {
  readonly alertId: string;
  readonly match: PastIncidentMatch;
  /** 類似のときの類似度 [0,1]（SIMILARITY 分類の confidence 由来）。exact は未設定＝100%。 */
  readonly confidence?: number;
  readonly rationale: string;
};

/** 確度チップの表示ラベル。一致は断定形、類似はスコアで段階表示する。 */
export function pastMatchLabel(ref: PastIncidentRef): string {
  if (ref.match === "exact") return "一致";
  return ref.confidence !== undefined
    ? `類似 ${Math.round(ref.confidence * 100)}%`
    : "類似";
}

/** 過去事例として意味を持つのは対処が済んだもの＝承認済み（feedback 正）または RESOLVED。 */
function isSettled(alert: AlertView): boolean {
  return alert.feedback?.isCorrect === true || alert.status === "RESOLVED";
}

/** 完全一致の過去事例は直近から数件に絞る（承認を重ねると際限なく増えるため）。 */
const PAST_EXACT_LIMIT = 3;

/**
 * 「過去の同型事例」を集約する。出所は3つ:
 *  - SIMILARITY 分類の back-link（sourceAlertId）＝類似検索が引いた解決済み事例（類似度付き）。
 *  - AI 相関のうち relation=similar ＝ AI が候補から見つけた過去の同型。
 *  - EXACT_MATCH 分類のとき、一覧（corpus）にある同 eventName の対処済み過去アラート＝完全一致の再発元。
 * 自分自身・重複 alertId は除外する（先勝ち＝確度の明示された back-link を優先）。
 */
export function collectPastIncidentRefs(
  alert: AlertView,
  corpus: readonly AlertView[] = [],
): PastIncidentRef[] {
  const refs: PastIncidentRef[] = [];

  if (
    alert.classification.type === "known" &&
    alert.classification.source === "SIMILARITY" &&
    alert.classification.sourceAlertId
  ) {
    refs.push({
      alertId: alert.classification.sourceAlertId,
      match: "similar",
      confidence: alert.classification.confidence,
      rationale: "過去に解決済みの同型障害。当時の対応が参考になります。",
    });
  }

  for (const ref of alert.report?.relatedAlerts ?? []) {
    if (ref.relation === SIMILAR_RELATION) {
      refs.push({
        alertId: ref.alertId,
        match: "similar",
        rationale: ref.rationale,
      });
    }
  }

  if (
    alert.classification.type === "known" &&
    alert.classification.source === "EXACT_MATCH"
  ) {
    const exactPast = corpus
      .filter(
        (a) =>
          a.id !== alert.id && a.eventName === alert.eventName && isSettled(a),
      )
      .sort(
        (a, b) =>
          new Date(b.occurredOn).getTime() - new Date(a.occurredOn).getTime(),
      )
      .slice(0, PAST_EXACT_LIMIT);
    for (const past of exactPast) {
      refs.push({
        alertId: past.id,
        match: "exact",
        rationale: "同一パターンとして過去に対処済みの事例。当時の対応が参考になります。",
      });
    }
  }

  const seen = new Set<string>([alert.id]);
  return refs.filter((ref) => {
    if (seen.has(ref.alertId)) return false;
    seen.add(ref.alertId);
    return true;
  });
}

export type PastIncidentView = {
  readonly alertId: string;
  readonly match: PastIncidentMatch;
  readonly matchLabel: string;
  readonly rationale: string;
  /** 一覧から解決できたか（解決時のみ title/severity/occurredOn を持つ）。 */
  readonly resolved: boolean;
  readonly title?: string;
  readonly severity?: AlertSeverity;
  readonly occurredOn?: string;
};

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

function toPastIncidentView(
  ref: PastIncidentRef,
  resolved: AlertView | undefined,
): PastIncidentView {
  const base = {
    alertId: ref.alertId,
    match: ref.match,
    matchLabel: pastMatchLabel(ref),
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

/** 過去事例参照を、一覧 lookup で表示用 View へ解決する純関数。 */
export function toPastIncidentViews(
  refs: readonly PastIncidentRef[],
  lookup: (id: string) => AlertView | undefined,
): PastIncidentView[] {
  return refs.map((ref) => toPastIncidentView(ref, lookup(ref.alertId)));
}
