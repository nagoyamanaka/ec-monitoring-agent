import { useEffect, useState } from "react";

/**
 * 予報生成（POST /forecast・約1分）の「待ち」を可視化するバナー。
 * アラート一覧の実検知待ち（DetectionPendingBanner・シナリオ3b）と**同じ視覚言語**:
 *
 * 課題（Lisa/UX）: 生成 POST は同期で約1分かかるが、従来はコンソールのボタン文言が
 * 変わるだけ＝プロダクトの売り（AI 予報）が「死んだ待ち時間」に見える。
 *
 * 解: 待ち時間を「AI が何をしているか」の説明時間に転化する。
 *  - 経過タイマー＋期待値（約1分）で不確実性を消す（Lisa）。
 *  - 通過中の実ステップ（収集→突合→引用検証→予報カード）を明示し、特に
 *    **引用検証＝実在しない引用を落とす**工程を語る（ハルシネーション否定の可視化
 *    ＝step6 §1.7 と同型の物語。David/Lisa）。
 *  - per-step テレメトリは持たないので「完了」を偽点灯させず、不定進捗（パルス）
 *    ＋「通過中」表現に留める（正直さの担保・3b と同じ規律）。
 *  - 想定超過時は打ち切り（90秒 timeout）の予告を出し、無限待ちの不安を作らない。
 *
 * POST の完了/失敗で親（ForecastPage）がこのバナーを畳む。ここは純表示。
 */

/** これを超えたら「時間がかかっています」ヒント（client timeout 90秒の予告込み）。 */
const SLOW_HINT_AFTER_SEC = 60;

const GENERATION_STEPS = [
  "シグナル収集",
  "突合",
  "引用検証（実在照合）",
  "予報カード",
] as const;

export interface ForecastGenerationPendingBannerProps {
  /** true＝再生成（既存の予報カードが下に見えている）。結果の着地先の文言を切替。 */
  regenerating: boolean;
}

export function ForecastGenerationPendingBanner({
  regenerating,
}: ForecastGenerationPendingBannerProps) {
  // 生成中にのみ mount される前提＝mount 時刻を開始時刻として良い。
  const [startedAt] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const slow = elapsedSec >= SLOW_HINT_AFTER_SEC;

  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-2 rounded-md bg-sky-500/10 px-3 py-3 text-[13px] ring-1 ring-inset ring-sky-500/30"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold text-sky-100">
          <span
            aria-hidden
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-300"
          />
          AI が調査中…
        </span>
        <span className="shrink-0 tabular-nums text-[11px] text-sky-200/80">
          経過 {elapsedSec} 秒 ・ 通常 約1分
        </span>
      </div>

      <p className="text-slate-300">
        投入シグナル（右のデモコンソールの台帳）を AI が1ショットで処理中:
      </p>

      {/* 通過中の実ステップ（不定進捗＝完了を偽点灯しない・3b と同じ規律）。 */}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-sky-200/90">
        {GENERATION_STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-1.5">
            <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 ring-1 ring-inset ring-sky-500/25">
              {step}
            </span>
            {i < GENERATION_STEPS.length - 1 && (
              <span aria-hidden className="text-sky-300/60">
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* 待ち時間を「売りの説明」に転化する1行（引用検証＝偽引用を機構的に落とす）。 */}
      <p className="text-slate-400">
        AI が生成した引用は収集済みの実在シグナルと照合し、実在しないものは落とします。
        {regenerating
          ? "完成すると下の予報カードが新しい内容に置き換わります。"
          : "完成するとここに予報カードが表示されます。"}
      </p>

      {slow && (
        <p className="text-amber-200/90">
          想定より時間がかかっています。90
          秒を超えた場合は打ち切り、エラーとして表示します。
        </p>
      )}
    </div>
  );
}
