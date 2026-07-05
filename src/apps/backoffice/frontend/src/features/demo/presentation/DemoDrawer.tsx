import { useEffect, useRef } from "react";
import type { DemoApi } from "../infrastructure/demoApi";
import { useDemoControls } from "./hooks/useDemoControls";
import { SystemStatus } from "./SystemStatus";
import { ScenarioControls } from "./ScenarioControls";

export interface DemoDrawerProps {
  api: DemoApi;
  /** reset 完了後に呼ばれるコールバック。アラート一覧の全件再取得に使う。 */
  onAfterReset?: () => void;
  /**
   * 値が変わるたびに /demo/status を再取得する（ValueStrip と同じイディオム）。
   * シナリオ注入は非同期にアラート化するため、注入直後の再取得だけでは
   * 「一覧にはアラートがあるのにアクティブアラート 0」とズレる。SSE 着弾
   * （useAlerts の lastUpdatedAt）を渡して件数を追随させる。
   */
  refreshKey?: number | null;
  /**
   * 最後に SSE で受信したアラート（category だけ読む・受信ごとに参照が変わる）。
   * 「検知待ち」バナーを、待った当のアラート（pendingDetection.matchCategory 一致）の
   * 着弾でのみ畳むために使う。remediation 等では参照が変わらないので誤クリアしない。
   */
  lastIncomingAlert?: { readonly category: string } | null;
}

/**
 * デモ操作ドロワー（タスク10）。AlertsLayout の右 aside にだけ差し込み、プロダクション UI を侵食しない。
 * DEMO_ENABLED=false の本番では /demo/status が 404 → available=false で**何も描画しない**。
 * シナリオ注入→一覧に SSE で障害が流れる、という「デモの舞台裏の操作卓」。
 */
export function DemoDrawer({
  api,
  onAfterReset,
  refreshKey,
  lastIncomingAlert,
}: DemoDrawerProps) {
  const {
    available,
    loading,
    status,
    error,
    busy,
    pendingDetection,
    triggerScenario,
    reset,
    refresh,
    clearPendingDetection,
  } = useDemoControls(api, { onAfterReset });

  // SSE 着弾（refreshKey 変化）で件数を追随。初回はフック側の初期取得に任せる。
  const initialKeyRef = useRef(true);
  useEffect(() => {
    if (initialKeyRef.current) {
      initialKeyRef.current = false;
      return;
    }
    if (refreshKey == null) return;
    void refresh();
  }, [refreshKey, refresh]);

  // 「検知待ち」を、待った当のアラートの着弾でだけ畳む（当てずっぽうで閉じない）。
  // 待機開始時点の lastIncomingAlert を snapshot し、その後に別参照の受信が来て、かつ
  // category が matchCategory と一致したときにのみ閉じる。lastIncomingAlert は remediation では
  // 参照が変わらないので誤クリアしない。matchCategory 未指定なら最初の受信で閉じる（緩い）。
  const pendingStartIncomingRef = useRef<{ category: string } | null>(null);
  const wasPendingRef = useRef(false);
  useEffect(() => {
    const isPending = pendingDetection !== null;
    if (isPending && !wasPendingRef.current) {
      // 待機開始: この瞬間の受信を基準にする（これ以前の着弾では閉じない）。
      pendingStartIncomingRef.current = lastIncomingAlert ?? null;
    } else if (
      isPending &&
      lastIncomingAlert != null &&
      lastIncomingAlert !== pendingStartIncomingRef.current
    ) {
      const want = pendingDetection?.matchCategory;
      if (want == null || lastIncomingAlert.category === want) {
        // 開始後に「当の category」の新規受信が来た＝アラート着弾。
        clearPendingDetection();
      }
    }
    wasPendingRef.current = isPending;
  }, [pendingDetection, lastIncomingAlert, clearPendingDetection]);

  // デモ無効（本番）なら丸ごと出さない。
  if (!available) return null;

  return (
    <section
      aria-label="デモコンソール"
      className="space-y-4 rounded-tremor-default bg-slate-900/40 p-4 ring-1 ring-inset ring-slate-700/60"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30">
          🕹️ デモコンソール
        </span>
      </div>

      <SystemStatus status={status} loading={loading} />
      <ScenarioControls
        busy={busy}
        onTrigger={triggerScenario}
        pendingDetection={pendingDetection}
        onDismissPending={clearPendingDetection}
      />

      <div className="space-y-2 border-t border-slate-700/50 pt-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => reset()}
          title="アラート一覧を空に戻し、既知パターン（学習済みの知識ベース）を初期状態に再投入する"
          className="w-full rounded-md bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-slate-700/60 transition hover:bg-rose-500/10 hover:text-rose-200 hover:ring-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
        >
          デモをリセット
        </button>
        {error && (
          <p className="text-[11px] text-rose-300">
            操作に失敗しました。{error.message}
          </p>
        )}
      </div>
    </section>
  );
}
