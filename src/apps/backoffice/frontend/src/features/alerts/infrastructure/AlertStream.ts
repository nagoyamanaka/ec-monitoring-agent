import type { AlertView } from "../domain/AlertView";

/**
 * ストリームの接続状態。UI のライブ表示（緑ランプ／接続中／切断）に使う。
 * - connecting: 接続試行中・再接続中（まだ open していない）
 * - open: 接続確立（ライブ受信中）
 * - closed: クローズ（再接続待ち）
 */
export type StreamStatus = "connecting" | "open" | "closed";

/**
 * Alert の push 抽象（SSE の関心事を隠蔽する port）。
 * SSE は infrastructure の関心事なので interface で抽象化し、hook が消費する。
 * 実装は SSEAlertStream（本番）/ MockAlertStream（テスト・デモ）。
 */
export interface AlertStream {
  /**
   * alert 受信ごとに onAlert を呼ぶ。戻り値は購読解除関数（unmount で呼ぶ）。
   * onStatus（任意）には接続状態の変化を通知する（ライブ表示用・実装は best-effort）。
   */
  subscribe(
    onAlert: (alert: AlertView) => void,
    onStatus?: (status: StreamStatus) => void,
  ): () => void;

  /**
   * 切断状態（closed）からの即時再接続。自動再接続タイマーをキャンセルして即実行する。
   * 未実装の場合（MockAlertStream 等）は何もしない（optional）。
   */
  reconnect?(): void;
}
