import { RemediationRecord } from "./RemediationRecord.js";

/**
 * dispatched（CI へ投入済み・結果待ち）の期限切れ。
 *
 * dispatch 経路の確定は CI からの callback に依存する。ジョブが落ちる・ネットワークが切れる・
 * ingest の宛先を配線し忘れる、のどれが起きても callback は来ず、record は dispatched のまま
 * 永久に残る＝画面は「確定待ち」を出し続ける。CI の誠実さに依存せず、時間で終端させる。
 *
 * ワークフロー側の on-missing-url:fail（届かない callback を緑にしない）は「送る側」の防御、
 * これは「受ける側」の防御で、片方だけでは閉じない。
 */

/** 期限切れとして落とすときに record へ残す理由。画面にそのまま出る。 */
export function dispatchExpiryReason(timeoutMs: number): string {
  const minutes = Math.max(1, Math.round(timeoutMs / 60000));
  return `CI の修正ジョブから ${minutes} 分以内に結果が返りませんでした（実行が失敗したか、結果の通知が届いていません）。GitHub Actions の実行結果を確認してください。`;
}

/** 期限切れ判定の境界時刻。これより前に受け付けた dispatched が対象。 */
export function dispatchExpiryThreshold(now: Date, timeoutMs: number): Date {
  return new Date(now.getTime() - timeoutMs);
}

/**
 * 期限切れの dispatched を failed へ落とした record を作る（純関数）。
 * vulnerabilityCount は dispatch 時の値を保つ（CI 結果の確定と同じ扱い）。
 */
export function expireDispatched(
  record: RemediationRecord,
  now: Date,
  timeoutMs: number,
): RemediationRecord {
  return {
    ...record,
    status: "failed",
    pullRequestUrl: null,
    reason: dispatchExpiryReason(timeoutMs),
    createdAt: now,
  };
}
