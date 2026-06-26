import type { AlertPrimitives } from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import type { RemediationResponsePrimitives } from "@monitoring/AIInvestigation/domain/contracts/RemediationContract";
import { type AlertView, toAlertView } from "../domain/AlertView";
import type { AlertStream, RemediationPushed, StreamStatus } from "./AlertStream";

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

  /**
   * 購読中に set される「即時再接続」クロージャ。subscribe の外からも呼べるように
   * インスタンスフィールドに保持し、切断時にユーザーが手動で再接続できるようにする。
   * 購読解除後は null にリセットする。
   */
  private _forceReconnect: (() => void) | null = null;

  /** 切断状態からの即時再接続（自動タイマーをキャンセルして即実行）。 */
  reconnect(): void {
    this._forceReconnect?.();
  }

  subscribe(
    onAlert: (alert: AlertView) => void,
    onStatus?: (status: StreamStatus) => void,
    onRemediation?: (remediation: RemediationPushed) => void,
  ): () => void {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const emitStatus = (status: StreamStatus) => onStatus?.(status);

    const handleMessage = (event: MessageEvent<string>) => {
      if (!event.data) return; // 空 data は無視（保険）
      try {
        const primitives = JSON.parse(event.data) as AlertPrimitives;
        onAlert(toAlertView(primitives));
      } catch {
        // 壊れた1行で購読全体を落とさない（黙って捨てる）
      }
    };

    // 名前付きイベント "remediation"（リメディ確定）。既定の alert イベントとは別ハンドラ。
    const handleRemediation = (event: MessageEvent<string>) => {
      if (!event.data || !onRemediation) return;
      try {
        onRemediation(JSON.parse(event.data) as RemediationResponsePrimitives);
      } catch {
        // 壊れた1行は黙って捨てる
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
        // 完全クローズ＝自前で再接続する。それまでは切断状態。
        source.close();
        source = null;
        emitStatus("closed");
        scheduleReconnect();
      } else {
        // 一過性エラー（EventSource が自前で再接続中）＝接続中表示に戻す。
        emitStatus("connecting");
      }
    };

    const connect = () => {
      if (closed) return;
      emitStatus("connecting");
      source = new EventSource(this.url);
      source.onopen = () => emitStatus("open");
      source.onmessage = handleMessage;
      source.addEventListener("remediation", handleRemediation);
      source.onerror = handleError;
    };

    // 切断時にユーザーが手動で即時再接続できるよう、クロージャをインスタンスに公開する。
    this._forceReconnect = () => {
      if (closed) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connect();
    };

    connect();

    return () => {
      this._forceReconnect = null;
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      source = null;
    };
  }
}
