import type { AlertView } from "../domain/AlertView";

/**
 * Alert の push 抽象（SSE の関心事を隠蔽する port）。
 * SSE は infrastructure の関心事なので interface で抽象化し、hook が消費する。
 * 実装は SSEAlertStream（本番）/ MockAlertStream（テスト・デモ）。
 */
export interface AlertStream {
  /** alert 受信ごとに onAlert を呼ぶ。戻り値は購読解除関数（unmount で呼ぶ）。 */
  subscribe(onAlert: (alert: AlertView) => void): () => void;
}
