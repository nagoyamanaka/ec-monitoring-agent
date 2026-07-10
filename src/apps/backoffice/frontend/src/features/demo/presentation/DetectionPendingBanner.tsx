import { useEffect, useState } from "react";
import type { PendingDetection } from "./hooks/useDemoControls";

/**
 * 実検知経路（Cloud Monitoring 発報）シナリオの「検知待ち」バナー。
 *
 * 課題（Lisa/UX）: 実検知シナリオは POST が 202 で即返るのにアラート着弾は約1分遅れる。
 * 押した直後にボタンが通常表示へ戻ると「押しても何も起きない」死んだ待ち時間になる。
 *
 * 解（床）: 待ち時間を「実パイプラインが検知している最中」として可視化する。
 *  - 押下受領を即座に示し、経過タイマー＋期待値（約1分）で不確実性を消す（Lisa）。
 *  - 通過中の実ホップ（500→Logging→Monitoring→Queue→Alert）を明示＝合成注入でない
 *    本物の検知経路である証拠として語れる（David / 公式観点「実運用 DevOps」）。
 *  - ステージは per-hop テレメトリを持たないので「完了」を偽点灯させず、
 *    不定進捗（パルス）＋「通過中」表現に留める（正直さの担保）。
 *  - 想定超過時は反復用（合成・即時）へ誘導し、行き止まりを作らない。
 *
 * 着弾（SSE）検知でこのバナーは親（DemoDrawer）が畳む。ここは純表示。
 */

/** 実検知の想定所要（約1分）。これを超えたら「時間がかかっています」ヒントを出す閾値。 */
const SLOW_HINT_AFTER_SEC = 90;

const PIPELINE_HOPS = [
  "HTTP 500",
  "Cloud Logging",
  "Cloud Monitoring 発報",
  "キュー",
  "アラート生成",
] as const;

export interface DetectionPendingBannerProps {
  pending: PendingDetection;
  /** 待機を手動で閉じる（着弾を待たずに一覧へ戻る導線）。 */
  onDismiss: () => void;
}

export function DetectionPendingBanner({
  pending,
  onDismiss,
}: DetectionPendingBannerProps) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - pending.startedAt) / 1000)),
  );

  useEffect(() => {
    const tick = () =>
      setElapsedSec(
        Math.max(0, Math.floor((Date.now() - pending.startedAt) / 1000)),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pending.startedAt]);

  const slow = elapsedSec >= SLOW_HINT_AFTER_SEC;

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-2 rounded-md bg-sky-500/10 px-3 py-3 text-[13px]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-sky-100">
          <span
            aria-hidden
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-300"
          />
          実パイプラインが検知中…
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-[11px] text-sky-200/80">
            経過 {elapsedSec} 秒 ・ 通常 約1分
          </span>
          {/* 閉じるだけ（state を null にするだけでクリーンアップ不要）。ローカルで邪魔なとき用。 */}
          <button
            type="button"
            aria-label="待機表示を閉じる"
            onClick={onDismiss}
            className="grid h-5 w-5 place-items-center rounded-md text-sky-200/70 transition hover:bg-sky-500/20 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span aria-hidden className="text-sm leading-none">
              ✕
            </span>
          </button>
        </span>
      </div>

      <p className="text-slate-300">
        <span className="font-medium text-slate-200">{pending.label}</span>{" "}
        を本番と同じ実検知経路で処理中:
      </p>

      {/* 通過中の実ホップ（不定進捗＝完了を偽点灯しない）。 */}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-sky-200/90">
        {PIPELINE_HOPS.map((hop, i) => (
          <li key={hop} className="flex items-center gap-1.5">
            <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5">
              {hop}
            </span>
            {i < PIPELINE_HOPS.length - 1 && (
              <span aria-hidden className="text-sky-300/60">
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* 結果が出る場所を指し示す（視線誘導）。バナーは console 内だが、着弾は一覧側に出る。 */}
      <p className="text-slate-400">
        検知されると、アラート一覧に新しい行が表示されます。
      </p>

      {slow && (
        <p className="text-amber-200/90">
          想定より時間がかかっています。反復用（合成・即時）でも同じ下流（分類→AI
          調査）を再現できます。
        </p>
      )}
    </div>
  );
}
