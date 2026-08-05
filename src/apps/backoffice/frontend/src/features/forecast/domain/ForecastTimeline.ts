import {
  DECLARED_REMEDIATION_MINUTES,
  effectiveLeadTime,
} from "@monitoring/Forecast/domain/remediationLeadTime";
import { resolveScheduleOccurrence } from "@monitoring/Forecast/domain/scheduleWindowOccurrence";
import type { RiskCardView } from "./ForecastView";

/**
 * 予兆リスクの時間軸（表示射影・純関数）。
 *
 * ## なぜ今まで描かなかったか、なぜ今なら描けるか
 *
 * `ForecastView` には**タイムチャートを却下した記録**がある——「`window` が LLM 由来の
 * 自由文字列で**時刻を捏造せずには描けない**ため不採用」。却下の根拠は時刻を決定論で
 * 引けないことだった。**引用している SCHEDULE シグナルから決定論で解決できるようになった**
 * ので（`scheduleWindowOccurrence`）、その根拠が消えた。⚠ 読むのは引用シグナルの `when`
 * （＝我々自身のスケジュール定義）であって、**`risk.window`（LLM 出力）は今も読まない**。
 *
 * ## 画面に足りていなかったのは「いつまでに動くか」
 *
 * カードは「いつ危ないか」（`window`）は持っていたが、**対処を始める期限**をどこにも
 * 出していなかった。有効リードタイム（E6-2）はその引き算そのものなので、数字ではなく
 * 軸として出す。3点だけを置く: **いま → 対処を始める期限 → 予測発生窓**。
 *
 * 解決できないリスクでは `undefined` を返し、呼び出し側は**軸ごと出さない**（先手ブロックと
 * 同じ縮退＝出せないものを埋めない）。
 */

/** 軸の1区間（0..1 の位置で持つ＝描画側は幅の計算をしない）。 */
export type TimelineSegment = {
  /** 軸の左端からの位置（0..1）。 */
  readonly start: number;
  /** 軸の左端からの終端位置（0..1）。 */
  readonly end: number;
};

export type ForecastTimelineView = {
  /** 予報の発行時刻＝軸の左端。 */
  readonly issuedAt: Date;
  /** 対処を始める期限＝予測発生 − 対処所要。**画面に無かったのがこれ。** */
  readonly deadlineAt: Date;
  /** 予測発生（窓の開始）。引用スケジュールから解決した値。 */
  readonly predictedAt: Date;
  /** 窓の終わり。スケジュールに終了時刻が書かれていなければ付かない。 */
  readonly windowEndsAt?: Date;
  /** 判断に使える時間（分）。**負を丸めない**——負であること自体が結論。 */
  readonly effectiveMinutes: number;
  /** 対処の所要（分）。**宣言値**であって実測ではない。 */
  readonly remediationMinutes: number;
  /** 解決の出所（`ScheduleWindow.when` の原文）。画面に出して検算できるようにする。 */
  readonly scheduleSource: string;
  /** いま → 期限。間に合わない場合は幅ゼロ。 */
  readonly decisionSegment: TimelineSegment;
  /** 期限 → 予測発生（＝対処所要ぶん）。 */
  readonly remediationSegment: TimelineSegment;
  /** 予測発生 → 窓の終わり（終了時刻が無ければ軸の右端まで）。 */
  readonly windowSegment: TimelineSegment;
  /** 対処が間に合わない見込みか（判断に使える時間が負）。 */
  readonly tooLate: boolean;
  /**
   * 日付の目盛り（業務ローカルの 0:00）。**軸の長さを一目で読ませるためだけ**に置く。
   * これが無いと、端のラベルを2つ読むまで「3時間先」か「4日先」かが分からない。
   * 本数が増えすぎる長い軸では間引く。
   */
  readonly dayTicks: readonly DayTick[];
};

export type DayTick = {
  /** 軸の左端からの位置（0..1）。 */
  readonly at: number;
  /** 目盛りのラベル（例 `8/6`）。 */
  readonly label: string;
};

const MINUTE_MS = 60_000;
/** 終了時刻が書かれていない窓の、軸上での見かけの長さ。**帯の幅を主張にしない**ための最小値。 */
const UNKNOWN_WINDOW_MINUTES = 30;

export function buildForecastTimeline(
  risk: RiskCardView,
  generatedAt: string,
): ForecastTimelineView | undefined {
  const issuedAt = new Date(generatedAt);
  if (Number.isNaN(issuedAt.getTime())) return undefined;

  // 引用した SCHEDULE のうち最も早く到来する窓（猶予を実際より長く見せない）。
  const occurrence = risk.citations
    .filter((citation) => citation.kind === "SCHEDULE")
    .map((citation) => resolveScheduleOccurrence(citation.when, issuedAt))
    .filter((o): o is NonNullable<typeof o> => o !== undefined)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  if (!occurrence) return undefined;

  const lead = effectiveLeadTime({ issuedAt, predictedAt: occurrence.startsAt });
  const deadlineAt = new Date(
    occurrence.startsAt.getTime() - lead.remediationMinutes * MINUTE_MS,
  );
  const axisEnd =
    occurrence.endsAt ??
    new Date(occurrence.startsAt.getTime() + UNKNOWN_WINDOW_MINUTES * MINUTE_MS);

  // 軸は「いま」から窓の終わりまで。既に期限を過ぎている場合も左端は「いま」のままにし、
  // 判断区間を幅ゼロに畳む（軸を巻き戻して"まだ間に合う"ように見せない）。
  const axis = { from: issuedAt.getTime(), to: axisEnd.getTime() };
  const at = (time: number) => ratio(time, axis);

  return {
    issuedAt,
    deadlineAt,
    predictedAt: occurrence.startsAt,
    ...(occurrence.endsAt ? { windowEndsAt: occurrence.endsAt } : {}),
    effectiveMinutes: lead.effectiveMinutes,
    remediationMinutes: lead.remediationMinutes,
    scheduleSource: occurrence.source,
    decisionSegment: { start: 0, end: at(deadlineAt.getTime()) },
    remediationSegment: {
      start: at(deadlineAt.getTime()),
      end: at(occurrence.startsAt.getTime()),
    },
    windowSegment: { start: at(occurrence.startsAt.getTime()), end: 1 },
    tooLate: lead.effectiveMinutes < 0,
    dayTicks: buildDayTicks(axis, at),
  };
}

const OFFSET_MS = 9 * 60 * MINUTE_MS; // Asia/Tokyo（DST が無いので固定オフセットで厳密）
const DAY_MS = 24 * 60 * MINUTE_MS;
/** これを超える本数になったら間引く（目盛りが密になると軸そのものが読めなくなる）。 */
const MAX_DAY_TICKS = 6;

function buildDayTicks(
  axis: { from: number; to: number },
  at: (time: number) => number,
): DayTick[] {
  // 軸内に入る業務ローカルの 0:00 を列挙する。
  const firstLocalMidnight =
    Math.ceil((axis.from + OFFSET_MS) / DAY_MS) * DAY_MS - OFFSET_MS;
  const all: number[] = [];
  for (let t = firstLocalMidnight; t < axis.to; t += DAY_MS) all.push(t);

  const step = Math.ceil(all.length / MAX_DAY_TICKS) || 1;
  return all
    .filter((_, index) => index % step === 0)
    .map((time) => ({
      at: at(time),
      label: new Date(time).toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
      }),
    }));
}

function ratio(time: number, axis: { from: number; to: number }): number {
  const span = axis.to - axis.from;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (time - axis.from) / span));
}

/** 「100時間16分」形式。分未満は出さない（丸めで猶予を長く見せない）。 */
export function formatDurationJa(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs}分`;
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

// 時刻表示は Contexts 側を単一ソースにする（PR コメントと同じ表記でないと突き合わせできない）。
export { formatBusinessDateTime } from "@monitoring/Forecast/domain/scheduleWindowOccurrence";
export { DECLARED_REMEDIATION_MINUTES };
