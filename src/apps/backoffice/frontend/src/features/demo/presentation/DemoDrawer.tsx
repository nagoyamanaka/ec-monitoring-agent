import { useEffect, useRef } from "react";
import type { DemoApi } from "../infrastructure/demoApi";
import { useDemoControls } from "./hooks/useDemoControls";
import { ScenarioControls } from "./ScenarioControls";
import { GamepadIcon } from "@shared/ui/icons";

export interface DemoDrawerProps {
  api: DemoApi;
  /** reset 完了後に呼ばれるコールバック。アラート一覧の全件再取得に使う。 */
  onAfterReset?: () => void;
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
 * 件数タイル（旧「現在の状態」）は持たない: アラート件数は隣の一覧が、既知化・昇格は
 * アラート行のチップと昇格通知が既に語っており、コンソール内の数字は冗長だった。
 */
export function DemoDrawer({
  api,
  onAfterReset,
  lastIncomingAlert,
}: DemoDrawerProps) {
  const {
    available,
    error,
    busy,
    pendingDetection,
    triggerScenario,
    reset,
    clearPendingDetection,
  } = useDemoControls(api, { onAfterReset });

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
        <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30">
          <GamepadIcon className="shrink-0" />
          デモコンソール
        </span>
      </div>

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
          <p className="text-xs text-rose-300">
            操作に失敗しました。{error.message}
          </p>
        )}
      </div>
    </section>
  );
}
