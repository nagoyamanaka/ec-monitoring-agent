import type { AlertView } from "../domain/AlertView";
import type { AlertStream, StreamStatus } from "./AlertStream";

/**
 * テスト・デモ用の AlertStream。emit() で任意の AlertView を購読者へ流せる。
 * SSE を立てずに「分析中 → 結果」演出をローカル再現でき、差し替え可能性が実在する。
 */
export class MockAlertStream implements AlertStream {
  private readonly listeners = new Set<(alert: AlertView) => void>();

  subscribe(
    onAlert: (alert: AlertView) => void,
    onStatus?: (status: StreamStatus) => void,
  ): () => void {
    this.listeners.add(onAlert);
    // 購読開始＝接続確立とみなす（デモでライブ表示を緑にする）。
    onStatus?.("open");
    return () => {
      this.listeners.delete(onAlert);
    };
  }

  /** 購読中の全リスナーへ alert を配信する（デモ/テストのトリガ）。 */
  emit(alert: AlertView): void {
    for (const listener of this.listeners) listener(alert);
  }

  /** 現在の購読者数（テスト検証用）。 */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
