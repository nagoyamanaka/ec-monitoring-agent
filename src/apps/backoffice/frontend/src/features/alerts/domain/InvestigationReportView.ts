import type {
  InvestigationReportPrimitives,
  InvestigationItemPrimitives,
  InvestigationLinkKind,
  InvestigationMetricsPrimitives,
  ConfidenceCalibrationPrimitives,
  CitationRefPrimitives,
  CitationSourceKind,
  ImpactFault,
  RemediationVerdict,
} from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import type { AlertSeverity } from "./AlertView";

/**
 * 調査レポートの表示用型と、ワイヤ契約（共有 contracts の InvestigationReportPrimitives）→ View の純関数。
 * domain は型＋純関数のみ。ワイヤ形式は backend と共有する単一ソース（型のみ・ランタイム非依存）を import する。
 */

export type ReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type { InvestigationLinkKind, ImpactFault, RemediationVerdict, CitationSourceKind };

/**
 * 引用の実在照合結果の表示用型。ワイヤ契約と同形（backend が証拠カタログとの突合を記録した事実）。
 * `kind` 未設定＝収集済み証拠に解決しなかった（未照合）で、隠さずそのまま表示する。
 */
export type CitationRefView = CitationRefPrimitives;

/**
 * 調査の実測メトリクス（経過時間・証拠件数内訳＝タスク G1「働きの明細」）の表示用型。
 * ワイヤ契約と同形（全て記録済みの事実）。表示文言への写像は `investigationWorkload.ts` が担う。
 */
export type InvestigationMetricsView = InvestigationMetricsPrimitives;

/**
 * 確信度キャリブレーションの記録（裏付けシグナル・上限・LLM 自己申告値）の表示用型。
 * ワイヤ契約と同形（全て backend が記録した事実）。表示文言への写像は
 * `confidenceCalibration.ts` が担う。
 */
export type ConfidenceCalibrationView = ConfidenceCalibrationPrimitives;

/**
 * 影響評価（自責他責・影響範囲・障害規模）の表示用型（タスク34）。
 * 一覧オーバレイは `scale` のみを要約に出し、詳細は全フィールド＋citations チップを出す（タスク37）。
 */
export type ImpactView = {
  readonly fault: ImpactFault;
  readonly scope: string;
  readonly scale: string;
  readonly affectedSubjects: string[];
  readonly citations: string[];
  // citations の実在照合結果（1:1 対応）。refs 無しの旧 Alert は生文字列表示にフォールバック。
  readonly citationRefs?: CitationRefView[];
};

/** 他責/運用案件のエスカレーション草案の表示用型（タスク35）。詳細のみで全表示する。 */
export type EscalationView = {
  readonly team: string;
  readonly owner: string;
  readonly contact: string;
  readonly reason: string;
  readonly interimWorkaround: string;
  readonly severityRationale: string;
  readonly evidenceBundle: string[];
  // evidenceBundle の実在照合結果（1:1 対応）。refs 無しの旧 Alert はフォールバック。
  readonly evidenceBundleRefs?: CitationRefView[];
};

/** 修正PR自動レビューの判定の表示用型（タスク36）。詳細のみで全表示する。 */
export type RemediationReviewView = {
  readonly verdict: RemediationVerdict;
  readonly concerns: string[];
  readonly pullRequestUrl: string;
  readonly citations: string[];
};

/**
 * AI 調査が見つけた相関アラートの参照（id・関係種別・根拠）。
 * 表示の解決（日時/severity/タイトル）は `domain/relatedAlerts.ts` が alerts 一覧から行う。
 */
export type RelatedAlertRef = {
  readonly alertId: string;
  readonly relation: string;
  readonly rationale: string;
};

/**
 * 調査ステップ／推奨アクションの表示用1項目。`href` があれば外部リンク化し `kind` でアイコン分け。
 * ワイヤは文字列も構造化オブジェクトも来るが、View では常にこの構造化形へ正規化済み。
 */
export type InvestigationStepView = {
  readonly text: string;
  readonly href?: string;
  readonly kind?: InvestigationLinkKind;
};

/** 表示用に型を絞った調査レポート。AlertCardExpanded / AlertDetailPage が消費する。 */
export type InvestigationReportView = {
  readonly summary: string;
  readonly confidence: number;
  readonly severity: AlertSeverity;
  readonly investigationSteps: InvestigationStepView[];
  readonly suggestedActions: InvestigationStepView[];
  readonly suggestedPatternName: string;
  readonly reviewStatus: ReviewStatus;
  readonly investigatedAt: string;
  readonly isFallback: boolean;
  // AI が「コードで直せる」と判定したか。remediate ボタンの活性／ROI 提示に使う（未指定は false）。
  readonly remediable: boolean;
  // AI 調査が見つけた相関アラート（id・関係・根拠）。未指定は空配列。
  readonly relatedAlerts: RelatedAlertRef[];
  // 影響評価（自責他責/影響範囲/障害規模）。後方互換のため optional（impact 無しの旧 Alert は未設定）。
  readonly impact?: ImpactView;
  // 他責/運用案件のエスカレーション草案。自責ルート・旧 Alert では未設定。
  readonly escalation?: EscalationView;
  // 修正PRの自動レビュー結果。PR 未起票・旧 Alert では未設定。
  readonly remediationReview?: RemediationReviewView;
  // 調査の実測メトリクス（タスク G1）。旧 Alert・未計測では未設定。
  readonly metrics?: InvestigationMetricsView;
  // 確信度キャリブレーションの記録。旧 Alert・fallback では未設定。
  readonly confidenceCalibration?: ConfidenceCalibrationView;
};

/** ワイヤ要素（文字列 or 構造化）を表示用の構造化形へ正規化。 */
function toStepView(item: InvestigationItemPrimitives): InvestigationStepView {
  if (typeof item === "string") return { text: item };
  return { text: item.text, href: item.href, kind: item.kind };
}

export function toInvestigationReportView(
  dto: InvestigationReportPrimitives,
): InvestigationReportView {
  return {
    summary: dto.summary,
    confidence: dto.confidence,
    severity: dto.severity as AlertSeverity,
    investigationSteps: dto.investigationSteps.map(toStepView),
    suggestedActions: dto.suggestedActions.map(toStepView),
    suggestedPatternName: dto.suggestedPatternName,
    reviewStatus: dto.reviewStatus as ReviewStatus,
    investigatedAt: dto.investigatedAt,
    isFallback: dto.isFallback,
    remediable: dto.remediable ?? false,
    relatedAlerts: (dto.relatedAlerts ?? []).map((r) => ({
      alertId: r.alertId,
      relation: r.relation,
      rationale: r.rationale,
    })),
    // impact/escalation/review はワイヤ optional（後方互換）。未設定なら View でも欠落させ、
    // 表示側は存在チェックで出し分ける（単一ソースからの射影＝データ二重持ちはしない）。
    ...(dto.impact
      ? {
          impact: {
            fault: dto.impact.fault,
            scope: dto.impact.scope,
            scale: dto.impact.scale,
            affectedSubjects: [...dto.impact.affectedSubjects],
            citations: [...dto.impact.citations],
            ...(dto.impact.citationRefs
              ? { citationRefs: [...dto.impact.citationRefs] }
              : {}),
          },
        }
      : {}),
    ...(dto.escalation
      ? {
          escalation: {
            team: dto.escalation.team,
            owner: dto.escalation.owner,
            contact: dto.escalation.contact,
            reason: dto.escalation.reason,
            interimWorkaround: dto.escalation.interimWorkaround,
            severityRationale: dto.escalation.severityRationale,
            evidenceBundle: [...dto.escalation.evidenceBundle],
            ...(dto.escalation.evidenceBundleRefs
              ? { evidenceBundleRefs: [...dto.escalation.evidenceBundleRefs] }
              : {}),
          },
        }
      : {}),
    ...(dto.remediationReview
      ? {
          remediationReview: {
            verdict: dto.remediationReview.verdict,
            concerns: [...dto.remediationReview.concerns],
            pullRequestUrl: dto.remediationReview.pullRequestUrl,
            citations: [...dto.remediationReview.citations],
          },
        }
      : {}),
    ...(dto.metrics
      ? {
          metrics: {
            elapsedMs: dto.metrics.elapsedMs,
            evidenceCounts: { ...dto.metrics.evidenceCounts },
          },
        }
      : {}),
    ...(dto.confidenceCalibration
      ? {
          confidenceCalibration: {
            signals: [...dto.confidenceCalibration.signals],
            cap: dto.confidenceCalibration.cap,
            original: dto.confidenceCalibration.original,
          },
        }
      : {}),
  };
}

/** レビュー済み（承認/却下）か。承認/却下ボタンの表示制御に使う純関数。 */
export function isReviewed(reviewStatus: ReviewStatus): boolean {
  return reviewStatus !== "PENDING_REVIEW";
}
