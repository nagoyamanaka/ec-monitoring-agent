import { useEffect, useRef } from "react";
import type { AlertView } from "../../domain/AlertView";
import type {
  AlertStream,
  RemediationPushed,
  StreamStatus,
} from "../../infrastructure/AlertStream";

/**
 * AlertStream の購読を React のライフサイクルへ橋渡しする hook（マージ責務は持たない薄いラッパ）。
 * - 受信ごとに onAlert / onRemediation を呼ぶ。state マージ／同一 ID 置換は呼び出し側が純関数で行う
 * - コールバックは ref 経由で最新を参照するため、毎レンダーで新しい関数を渡しても再購読しない
 * - 再購読は stream の同一性が変わったときのみ。unmount で購読解除する
 */
export function useAlertStream(
  stream: AlertStream,
  onAlert: (alert: AlertView) => void,
  onStatus?: (status: StreamStatus) => void,
  onRemediation?: (remediation: RemediationPushed) => void,
): void {
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onRemediationRef = useRef(onRemediation);
  onRemediationRef.current = onRemediation;

  useEffect(() => {
    const unsubscribe = stream.subscribe(
      (alert) => onAlertRef.current(alert),
      (status) => onStatusRef.current?.(status),
      (remediation) => onRemediationRef.current?.(remediation),
    );
    return unsubscribe;
  }, [stream]);
}
