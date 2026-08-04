import {
  AlertClassification,
  alertClassificationFromPrimitives,
  alertClassificationToPrimitives,
  KnownAlertClassification,
  UnknownAlertClassification,
} from "./AlertClassification.js";
import { AlertId } from "./AlertId.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { AlertStatus } from "./AlertStatus.js";
import { MonitoringEvent } from "../../Shared/domain/MonitoringEvent.js";
import { InvestigationReport } from "./InvestigationReport.js";
import { ReviewStatus } from "./ReviewStatus.js";
import { AggregateRoot } from "../../../Shared/domain/AggregateRoot.js";
import type {
  AlertPrimitives,
  ReviewDecision,
  ReviewDecisionSource,
  ReviewRecordPrimitives,
} from "./contracts/AlertContract.js";

// シリアライズ契約は contracts に一元化（backend/frontend 共通の単一ソース）。
export type { AlertPrimitives, ReviewDecision, ReviewDecisionSource };

type AlertFeedback = {
  readonly isCorrect: boolean;
  readonly operatorNote?: string;
};

/**
 * 1件の判定の記録。ワイヤ形（ReviewRecordPrimitives）との差は decidedAt が Date であることだけ。
 * `isCorrect` の主語は AI（診断が当たっていたか）、`decision` の主語は人間（それを受けて何を選んだか）。
 */
export type ReviewRecord = {
  readonly isCorrect: boolean;
  readonly decision: ReviewDecision;
  readonly decisionSource: ReviewDecisionSource;
  readonly operatorNote: string | null;
  readonly decidedAt: Date | null;
  readonly reportRevision: number;
};

// 「障害が起きた」という事実とその後の状態を追跡する
export class Alert extends AggregateRoot {
  readonly id: AlertId;
  readonly createdAt: Date;
  private readonly _monitoringEvent: MonitoringEvent;
  private readonly _severity: AlertSeverity;
  private readonly _status: AlertStatus;
  private readonly _classification: AlertClassification;
  private readonly _investigationReport: InvestigationReport | null;
  private readonly _feedback: AlertFeedback | null;
  // 判定の履歴（追記のみ）。_feedback が「最新の判定」という状態の射影であるのに対し、
  // こちらは判定という事実の記録。やり直し（reopenForReinvestigation）は状態を戻すが事実は消さない。
  private readonly _reviewHistory: readonly ReviewRecord[];
  // レポートの版数。0=レポート未着、以降 attachInvestigationReport のたびに +1。
  // 判定がどの版のレポートに対するものかを ReviewRecord に刻むために持つ。
  private readonly _reportRevision: number;
  private readonly _correctFeedbackCount: number;
  // 重複観測の畳み込みキー（monitoringEvent.dedupKey() を materialize）と発生回数。
  // dedupKey はクエリ容易性のため Alert ドキュメントの一級フィールドとして持つ
  // （monitoringEvent から導出可能だが、検索のために非正規化する）。
  private readonly _dedupKey: string;
  private readonly _occurrenceCount: number;
  private readonly _updatedAt: Date;

  private constructor(params: {
    id: AlertId;
    monitoringEvent: MonitoringEvent;
    severity: AlertSeverity;
    status: AlertStatus;
    classification: AlertClassification;
    investigationReport: InvestigationReport | null;
    feedback: AlertFeedback | null;
    reviewHistory: readonly ReviewRecord[];
    reportRevision: number;
    correctFeedbackCount: number;
    dedupKey: string;
    occurrenceCount: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    super();
    this.id = params.id;
    this._monitoringEvent = params.monitoringEvent;
    this._severity = params.severity;
    this._status = params.status;
    this._classification = params.classification;
    this._investigationReport = params.investigationReport;
    this._feedback = params.feedback;
    this._reviewHistory = params.reviewHistory;
    this._reportRevision = params.reportRevision;
    this._correctFeedbackCount = params.correctFeedbackCount;
    this._dedupKey = params.dedupKey;
    this._occurrenceCount = params.occurrenceCount;
    this.createdAt = params.createdAt;
    this._updatedAt = params.updatedAt;
  }

  get monitoringEvent(): MonitoringEvent {
    return this._monitoringEvent;
  }

  get severity(): AlertSeverity {
    return this._severity;
  }

  get status(): AlertStatus {
    return this._status;
  }

  get classification(): AlertClassification {
    return this._classification;
  }

  get investigationReport(): InvestigationReport | null {
    return this._investigationReport;
  }

  get feedback(): AlertFeedback | null {
    return this._feedback;
  }

  /**
   * 判定の履歴（古い順・追記のみ）。正答率の母数はここから数える＝却下 → 再調査 → 承認 が
   * 2件として残る（feedback から数えると却下が消える）。
   */
  get reviewHistory(): readonly ReviewRecord[] {
    return this._reviewHistory;
  }

  get reportRevision(): number {
    return this._reportRevision;
  }

  /**
   * オペレーターが分類を承認済み（＝対処済み）か。承認後は現役一覧には残すが、
   * 同型障害の再観測をこの Alert へ畳み込まない（dedup 窓から外す）判定に使う。
   * これにより承認後の再発火は新規アラートとして開き、昇格済みなら即・既知の高速パスに乗る。
   */
  isApproved(): boolean {
    return this._feedback?.isCorrect === true;
  }

  get correctFeedbackCount(): number {
    return this._correctFeedbackCount;
  }

  get dedupKey(): string {
    return this._dedupKey;
  }

  get occurrenceCount(): number {
    return this._occurrenceCount;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static createFromKnownPattern(params: {
    id: AlertId;
    monitoringEvent: MonitoringEvent;
    classification: KnownAlertClassification;
  }): Alert {
    const now = new Date();
    return new Alert({
      id: params.id,
      monitoringEvent: params.monitoringEvent,
      severity: params.classification.severity,
      status: AlertStatus.open(),
      classification: params.classification,
      investigationReport: null,
      feedback: null,
      reviewHistory: [],
      reportRevision: 0,
      correctFeedbackCount: 0,
      dedupKey: params.monitoringEvent.dedupKey(),
      occurrenceCount: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  static createAsUnknown(params: {
    id: AlertId;
    monitoringEvent: MonitoringEvent;
  }): Alert {
    const now = new Date();
    const classification: UnknownAlertClassification = {
      type: "unknown",
      confidence: null,
    };
    return new Alert({
      id: params.id,
      monitoringEvent: params.monitoringEvent,
      // ソースが観測時点で付与した重大度を初期値に使う（AI調査が後で精緻化）。
      // ソースが判断できない場合は monitoringEvent.severity が PENDING になりうる。
      severity: params.monitoringEvent.severity,
      status: AlertStatus.analyzing(),
      classification,
      investigationReport: null,
      feedback: null,
      reviewHistory: [],
      reportRevision: 0,
      correctFeedbackCount: 0,
      dedupKey: params.monitoringEvent.dedupKey(),
      occurrenceCount: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * 同一 dedupKey の重複観測を受けたときの畳み込み。新規 Alert を作らず発生回数を増やす。
   * 分類・調査・状態はそのまま（既に分類済み/調査中の同一インシデント）。UI は「×N」で表示。
   */
  recordOccurrence(): Alert {
    return new Alert({
      id: this.id,
      monitoringEvent: this._monitoringEvent,
      severity: this._severity,
      status: this._status,
      classification: this._classification,
      investigationReport: this._investigationReport,
      feedback: this._feedback,
      reviewHistory: this._reviewHistory,
      reportRevision: this._reportRevision,
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount + 1,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * 人間の指摘を受けた再調査の開始。状態を ANALYZING に戻し、過去のレビュー（feedback）を
   * クリアする＝再調査後の新しいレポートを白紙で承認/却下できるようにする。
   * 既存の分類・レポートは新レポート到着まで表示用に保持する（待機中の文脈を失わない）。
   * 「却下＝二値学習」とは別概念（やり直し）のため、correctFeedbackCount は減らさない。
   * 白紙に戻すのは「最新の判定」という状態（feedback）だけで、判定が行われたという事実
   * （reviewHistory）には触れない——ここを消すと却下が正答率の母数から抜ける（ADR-27 の測定ギャップ）。
   */
  reopenForReinvestigation(): Alert {
    return new Alert({
      id: this.id,
      monitoringEvent: this._monitoringEvent,
      severity: this._severity,
      status: AlertStatus.analyzing(),
      classification: this._classification,
      investigationReport: this._investigationReport,
      feedback: null,
      reviewHistory: this._reviewHistory,
      reportRevision: this._reportRevision,
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * オンデマンド AI 調査の開始（既知一致など AI 自動起動なしで即確定した Alert に対する明示要求）。
   * 状態を ANALYZING に遷移するだけで、分類・既存レポート・レビュー（feedback）は保持する
   * ＝「分類の承認」を消さずに「今回paramの調査レポート生成中」だけを即時可視化する。
   * reopenForReinvestigation（feedback をクリアする“やり直し”）とは別概念。
   */
  beginInvestigation(): Alert {
    return new Alert({
      id: this.id,
      monitoringEvent: this._monitoringEvent,
      severity: this._severity,
      status: AlertStatus.analyzing(),
      classification: this._classification,
      investigationReport: this._investigationReport,
      feedback: this._feedback,
      reviewHistory: this._reviewHistory,
      reportRevision: this._reportRevision,
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  attachInvestigationReport(report: InvestigationReport): Alert {
    return new Alert({
      id: this.id,
      monitoringEvent: this._monitoringEvent,
      severity: report.severity,
      status: AlertStatus.open(),
      classification: this._classification,
      investigationReport: report,
      feedback: this._feedback,
      reviewHistory: this._reviewHistory,
      // 新しい版のレポート＝以降の判定は別の版に対するものになる。
      reportRevision: this._reportRevision + 1,
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * オペレーターの判定。「最新の判定」（feedback / reviewStatus）を上書きすると同時に、
   * 履歴へ1件追記する。`decision` 未指定は現行 UI（承認/却下の二値）からの呼び出しで、
   * isCorrect から導出した暫定値を derived と明示して置く（推測値を実測値の顔で残さない）。
   */
  submitFeedback(params: {
    isCorrect: boolean;
    operatorNote?: string;
    decision?: ReviewDecision;
  }): Alert {
    const reviewStatus = params.isCorrect
      ? ReviewStatus.approved()
      : ReviewStatus.rejected();

    const record: ReviewRecord = {
      isCorrect: params.isCorrect,
      decision: params.decision ?? (params.isCorrect ? "acted" : "rejected"),
      decisionSource: params.decision ? "operator" : "derived",
      operatorNote: params.operatorNote ?? null,
      decidedAt: new Date(),
      reportRevision: this._reportRevision,
    };

    return new Alert({
      id: this.id,
      monitoringEvent: this._monitoringEvent,
      severity: this._severity,
      status: this._status,
      classification: this._classification,
      investigationReport:
        this._investigationReport?.withReviewStatus(reviewStatus) ?? null,
      feedback: {
        isCorrect: params.isCorrect,
        operatorNote: params.operatorNote,
      },
      reviewHistory: [...this._reviewHistory, record],
      reportRevision: this._reportRevision,
      correctFeedbackCount: params.isCorrect
        ? this._correctFeedbackCount + 1
        : this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  toPrimitives(): AlertPrimitives {
    return {
      id: this.id.value,
      monitoringEvent: this._monitoringEvent.toPrimitives(),
      severity: this._severity.value,
      status: this._status.value,
      classification: alertClassificationToPrimitives(this._classification),
      investigationReport: this._investigationReport?.toPrimitives() ?? null,
      feedback: this._feedback ? { ...this._feedback } : null,
      reviewHistory: this._reviewHistory.map((record) => ({
        ...record,
        decidedAt: record.decidedAt?.toISOString() ?? null,
      })),
      reportRevision: this._reportRevision,
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  static fromPrimitives(primitives: AlertPrimitives): Alert {
    const monitoringEvent = MonitoringEvent.fromPrimitives(
      primitives.monitoringEvent,
    );
    return new Alert({
      id: new AlertId(primitives.id),
      monitoringEvent,
      severity: AlertSeverity.fromString(primitives.severity),
      status: AlertStatus.fromString(primitives.status),
      classification: alertClassificationFromPrimitives(
        primitives.classification,
      ),
      investigationReport: primitives.investigationReport
        ? InvestigationReport.fromPrimitives(primitives.investigationReport)
        : null,
      feedback: primitives.feedback ?? null,
      reviewHistory: restoreReviewHistory(primitives),
      // 旧データ互換: 版数未保存の Alert はレポートの有無から 1/0 に畳む。
      reportRevision:
        primitives.reportRevision ?? (primitives.investigationReport ? 1 : 0),
      correctFeedbackCount: primitives.correctFeedbackCount,
      // 旧データ互換: dedupKey 未保存の Alert は monitoringEvent から再導出、回数は 1。
      dedupKey: primitives.dedupKey ?? monitoringEvent.dedupKey(),
      occurrenceCount: primitives.occurrenceCount ?? 1,
      createdAt: new Date(primitives.createdAt),
      updatedAt: new Date(primitives.updatedAt),
    });
  }
}

/**
 * 判定履歴の復元。履歴が空でありながら判定（feedback）だけがある Alert は、
 * 履歴を持たなかった頃のデータ（およびデモ seed の埋め込み判定）なので、feedback から1件を復元する
 * ——ここを空のままにすると、既存の正答率の母数が実装変更だけで縮む（測定値を実装都合で動かさない）。
 * 当時 decision と decidedAt は記録していないため、暫定値であることを derived / null で残す。
 * 判定を1件も受けていない Alert は履歴も空のままで、復元は起きない。
 */
function restoreReviewHistory(primitives: AlertPrimitives): ReviewRecord[] {
  const stored = primitives.reviewHistory ?? [];
  if (stored.length > 0) return stored.map(toReviewRecord);

  const feedback = primitives.feedback;
  if (feedback === null || feedback === undefined) return [];
  return [
    {
      isCorrect: feedback.isCorrect,
      decision: feedback.isCorrect ? "acted" : "rejected",
      decisionSource: "derived",
      operatorNote: feedback.operatorNote ?? null,
      decidedAt: null,
      reportRevision: primitives.investigationReport ? 1 : 0,
    },
  ];
}

function toReviewRecord(record: ReviewRecordPrimitives): ReviewRecord {
  return {
    isCorrect: record.isCorrect,
    decision: record.decision,
    decisionSource: record.decisionSource,
    operatorNote: record.operatorNote,
    decidedAt: record.decidedAt ? new Date(record.decidedAt) : null,
    reportRevision: record.reportRevision,
  };
}
