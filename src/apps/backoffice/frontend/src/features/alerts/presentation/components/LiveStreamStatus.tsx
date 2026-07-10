import { useAlertsDataOptional } from "../AlertsDataProvider";
import { StreamStatusIndicator } from "./StreamStatusIndicator";

/**
 * 共有 SSE 接続状態をヘッダ右スロットへ出す接続済みインジケータ。
 * SSE はアプリ全体で1本（AlertsDataProvider）なので、接続ランプも全ページ
 * （アラート/学習/予兆）で同じものを映す＝ページごとの配線漏れで消えないようここに集約。
 * プロバイダ外（ページ単体テスト等）では何も描かない。
 */
export function LiveStreamStatus() {
  const data = useAlertsDataOptional();
  if (!data) return null;
  return (
    <StreamStatusIndicator
      status={data.streamStatus}
      lastUpdatedAt={data.lastUpdatedAt}
      lastEvent={data.lastEvent}
      onReconnect={data.reconnectStream}
    />
  );
}
