import {
  formatBusinessDateTime,
  formatDurationJa,
  type ForecastTimelineView,
} from "../../domain/ForecastTimeline";
import type { RiskCardView } from "../../domain/ForecastView";

/**
 * リスク1件の時間軸（**いま → 対処を始める期限 → 予測発生窓**）。
 *
 * カードは「いつ危ないか」は持っていたが「**いつまでに動くか**」を持っていなかった。
 * 有効リードタイム（E6-2）はその引き算そのものなので、数字を1つ足すのではなく軸にする。
 *
 * ## 目盛りを打つ規律
 *
 * - **線形スケールのまま描く。** 対処30分が103時間の軸で髪の毛のように細いのは事実で、
 *   「直す時間に対して判断の時間が圧倒的に長い」がこのリスクの結論そのもの。見やすさの
 *   ために対処区間を太らせると、間に合う/間に合わないの見え方を歪める
 * - **配色は既存の軸を借りる**（`laneColors`）: スケジュール＝amber なので発生窓は amber、
 *   人が動ける区間は先手ブロックと同じ cyan。新しい色を持ち込まない
 * - **宣言値は破線で示す。** 対処30分は実測ではないので、実測由来の区間と線種で分ける
 * - **終了時刻が書かれていない窓は幅を主張しない**（モデル側で最小長にとどめる）
 */
export interface ForecastTimelineProps {
  /**
   * 組み立て済みの軸。**呼び出し側が組み立てる**——カードは「軸を描けるか」で見出しの
   * 出し方を変える（描けないときだけ window を補足行へ戻す）ので、判定を2回やらない。
   */
  timeline: ForecastTimelineView;
  risk: RiskCardView;
}

export function ForecastTimeline({ timeline, risk }: ForecastTimelineProps) {
  return (
    <div className="space-y-2 rounded-lg bg-slate-900/40 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px]">
        <span className="text-slate-400">
          いま {formatBusinessDateTime(timeline.issuedAt)}
        </span>
        <span className="font-medium text-amber-300">
          予測発生 {formatBusinessDateTime(timeline.predictedAt)}
        </span>
      </div>

      <Axis timeline={timeline} risk={risk} />

      {/* 日の目盛り。軸の長さ（3時間先なのか4日先なのか）を一目で読ませる。 */}
      {timeline.dayTicks.length > 0 && (
        <div className="relative h-3" aria-hidden="true">
          {timeline.dayTicks.map((tick) => (
            <span
              key={tick.label}
              // 中央寄せにしない——目盛り線は tick.at ちょうどに立てる（ラベル幅のぶん
              // ずれると、軸上の位置と日付が食い違う）。ラベルは線の右へ流す。
              className="absolute top-0 border-l border-slate-600/70 pl-1 text-[10px] leading-none text-slate-500"
              style={{ left: percent(tick.at) }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      )}

      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
        <span
          className={
            timeline.tooLate ? "font-medium text-rose-300" : "font-medium text-cyan-300"
          }
        >
          {timeline.tooLate
            ? `対処が間に合わない見込み（${formatDurationJa(timeline.effectiveMinutes)}の不足）`
            : `判断に使える時間 ${formatDurationJa(timeline.effectiveMinutes)}`}
        </span>
        <span>
          対処を始める期限 {formatBusinessDateTime(timeline.deadlineAt)}
        </span>
        <span>対処の所要 {timeline.remediationMinutes}分（宣言値）</span>
      </p>

      {/* 時刻の出所。決定論で引いたことが検算できないと、軸は「それっぽい絵」になる。 */}
      <p className="text-[11px] text-slate-500">
        予測発生は引用したスケジュール「{timeline.scheduleSource}」から解決（推論値ではありません）
      </p>
    </div>
  );
}

function Axis({
  timeline,
  risk,
}: {
  timeline: ForecastTimelineView;
  risk: RiskCardView;
}) {
  return (
    <div
      className="relative h-2.5 overflow-hidden rounded-full bg-slate-700/40"
      role="img"
      aria-label={axisLabel(timeline, risk)}
    >
      {/* 人が判断に使える区間（実測由来＝ベタ塗り）。 */}
      <span
        className="absolute inset-y-0 rounded-l-full bg-cyan-500/60"
        style={span(timeline.decisionSegment)}
      />
      {/* 対処の所要（宣言値＝斜線で実測と区別）。 */}
      <span
        className="absolute inset-y-0 bg-slate-400/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(226,232,240,0.5)_2px,rgba(226,232,240,0.5)_4px)]"
        style={span(timeline.remediationSegment)}
      />
      {/* 発生窓（スケジュール＝amber・laneColors と同軸）。 */}
      <span
        className="absolute inset-y-0 rounded-r-full bg-amber-500/70"
        style={span(timeline.windowSegment)}
      />
      {/* 期限の目盛り。ここが「いつまでに動くか」の一点なので、細くても必ず立てる。 */}
      <span
        className="absolute inset-y-0 w-px bg-slate-100"
        style={{ left: percent(timeline.decisionSegment.end) }}
      />
      {/* 左端の起点。これが無いと、ほぼ cyan で埋まった帯が「進捗バー」に読める
          （軸の 96% が判断に使える時間なのは事実だが、進捗ではない）。 */}
      <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-slate-100" />
    </div>
  );
}

function span(segment: { start: number; end: number }) {
  return {
    left: percent(segment.start),
    width: percent(Math.max(0, segment.end - segment.start)),
  };
}

function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

/** 軸は色と長さで語るので、同じ内容を読み上げ用に1文で持たせる。 */
function axisLabel(timeline: ForecastTimelineView, risk: RiskCardView): string {
  const head = `${risk.window} の発生に対し、対処を始める期限は ${formatBusinessDateTime(timeline.deadlineAt)}`;
  return timeline.tooLate
    ? `${head}。対処が間に合わない見込み（${formatDurationJa(timeline.effectiveMinutes)}の不足）。`
    : `${head}。判断に使える時間は ${formatDurationJa(timeline.effectiveMinutes)}。`;
}
