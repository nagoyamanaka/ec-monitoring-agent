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
import type { AlertPrimitives } from "./contracts/AlertContract.js";

// シリアライズ契約は contracts に一元化（backend/frontend 共通の単一ソース）。
export type { AlertPrimitives };

type AlertFeedback = {
  readonly isCorrect: boolean;
  readonly operatorNote?: string;
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
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * インシデントのクローズ（status → RESOLVED）。承認（分類が正しいと確定）した時点で
   * 「対処すべき現役アラート」ではなくなるため現役一覧から下ろす。分類・レポート・レビューは保持し
   * 過去の判断として analytics から辿れる。RESOLVED は dedup の畳み込み窓（OPEN/ANALYZING）から
   * 外れるので、同型障害が再発すると畳み込まれず classify に到達し、昇格済みなら即・既知の高速パスに乗る。
   */
  resolve(): Alert {
    return new Alert({
      id: this.id,
      monitoringEvent: this._monitoringEvent,
      severity: this._severity,
      status: AlertStatus.resolved(),
      classification: this._classification,
      investigationReport: this._investigationReport,
      feedback: this._feedback,
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * クローズの取り消し（status → OPEN）。承認→却下のやり直し（誤承認の訂正）で、
   * resolve() で下ろしたアラートを現役一覧へ戻す。reopenForReinvestigation（ANALYZING へ戻し
   * feedback をクリアする“再調査”）とは別概念で、状態のみ OPEN に戻し分類・レポート・feedback は保持する。
   */
  reopen(): Alert {
    return new Alert({
      id: this.id,
      monitoringEvent: this._monitoringEvent,
      severity: this._severity,
      status: AlertStatus.open(),
      classification: this._classification,
      investigationReport: this._investigationReport,
      feedback: this._feedback,
      correctFeedbackCount: this._correctFeedbackCount,
      dedupKey: this._dedupKey,
      occurrenceCount: this._occurrenceCount,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });
  }

  submitFeedback(params: { isCorrect: boolean; operatorNote?: string }): Alert {
    const reviewStatus = params.isCorrect
      ? ReviewStatus.approved()
      : ReviewStatus.rejected();

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
      correctFeedbackCount: primitives.correctFeedbackCount,
      // 旧データ互換: dedupKey 未保存の Alert は monitoringEvent から再導出、回数は 1。
      dedupKey: primitives.dedupKey ?? monitoringEvent.dedupKey(),
      occurrenceCount: primitives.occurrenceCount ?? 1,
      createdAt: new Date(primitives.createdAt),
      updatedAt: new Date(primitives.updatedAt),
    });
  }
}
