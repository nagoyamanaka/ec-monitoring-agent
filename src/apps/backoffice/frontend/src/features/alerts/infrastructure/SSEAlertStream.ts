import type { AlertPrimitives } from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import { type AlertView, toAlertView } from "../domain/AlertView";
import type { AlertStream } from "./AlertStream";

const DEFAULT_URL = "/alerts/stream";
const RECONNECT_DELAY_MS = 3_000;

/**
 * EventSource ベースの AlertStream 実装。
 * - 受信 `data:` を AlertPrimitives として parse → toAlertView → onAlert
 * - heartbeat（サーバの `: ...` コメント行）は EventSource が message として配送しないため自動的に無視される
 * - 接続が完全クローズ（readyState === CLOSED）した場合のみ手動で再接続する
 *   （一過性エラーは EventSource が自前で再接続するため二重に張らない）
 */
export class SSEAlertStream implements AlertStream {
  constructor(private readonly url: string = DEFAULT_URL) {}

  subscribe(onAlert: (alert: AlertView) => void): () => void {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const handleMessage = (event: MessageEvent<string>) => {
      if (!event.data) return; // 空 data は無視（保険）
      try {
        const primitives = JSON.parse(event.data) as AlertPrimitives;
        onAlert(toAlertView(primitives));
      } catch {
        // 壊れた1行で購読全体を落とさない（黙って捨てる）
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, RECONNECT_DELAY_MS);
    };

    const handleError = () => {
      if (source && source.readyState === EventSource.CLOSED) {
        source.close();
        source = null;
        scheduleReconnect();
      }
    };

    const connect = () => {
      if (closed) return;
      source = new EventSource(this.url);
      source.onmessage = handleMessage;
      source.onerror = handleError;
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      source = null;
    };
  }
}
