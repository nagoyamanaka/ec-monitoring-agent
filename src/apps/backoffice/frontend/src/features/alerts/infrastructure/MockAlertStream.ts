import type { AlertView } from "../domain/AlertView";
import type {
  AlertStream,
  InvestigationProgressPushed,
  RemediationPushed,
  StreamStatus,
} from "./AlertStream";

/**
 * テスト・デモ用の AlertStream。emit() で任意の AlertView を、emitRemediation() で
 * リメディ確定を、emitInvestigationProgress() で調査進行イベントを購読者へ流せる。
 * SSE を立てずに「分析中 → 結果」「dispatched → drafted」演出をローカル再現でき、差し替え可能性が実在する。
 */
export class MockAlertStream implements AlertStream {
  private readonly alertListeners = new Set<(alert: AlertView) => void>();
  private readonly remediationListeners = new Set<
    (remediation: RemediationPushed) => void
  >();
  private readonly progressListeners = new Set<
    (progress: InvestigationProgressPushed) => void
  >();

  subscribe(
    onAlert: (alert: AlertView) => void,
    onStatus?: (status: StreamStatus) => void,
    onRemediation?: (remediation: RemediationPushed) => void,
    onInvestigationProgress?: (progress: InvestigationProgressPushed) => void,
  ): () => void {
    this.alertListeners.add(onAlert);
    if (onRemediation) this.remediationListeners.add(onRemediation);
    if (onInvestigationProgress)
      this.progressListeners.add(onInvestigationProgress);
    // 購読開始＝接続確立とみなす（デモでライブ表示を緑にする）。
    onStatus?.("open");
    return () => {
      this.alertListeners.delete(onAlert);
      if (onRemediation) this.remediationListeners.delete(onRemediation);
      if (onInvestigationProgress)
        this.progressListeners.delete(onInvestigationProgress);
    };
  }

  /** 購読中の全リスナーへ alert を配信する（デモ/テストのトリガ）。 */
  emit(alert: AlertView): void {
    for (const listener of this.alertListeners) listener(alert);
  }

  /** 購読中の全リスナーへ remediation 確定を配信する。 */
  emitRemediation(remediation: RemediationPushed): void {
    for (const listener of this.remediationListeners) listener(remediation);
  }

  /** 購読中の全リスナーへ調査進行イベントを配信する（E1(b) のローカル再現）。 */
  emitInvestigationProgress(progress: InvestigationProgressPushed): void {
    for (const listener of this.progressListeners) listener(progress);
  }

  /** 現在の購読者数（テスト検証用）。 */
  get listenerCount(): number {
    return this.alertListeners.size;
  }
}
