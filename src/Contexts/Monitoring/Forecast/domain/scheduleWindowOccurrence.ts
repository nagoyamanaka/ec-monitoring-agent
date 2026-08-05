/**
 * スケジュール窓（`ScheduleWindow.when`）を実時刻へ解決する（E7・純関数）。
 *
 * ## なぜこれが要るか
 *
 * 有効リードタイム（E6-2）は `予測発生 − 発行 − 対処所要` で、**予測発生時刻**だけが
 * 実測でも宣言値でもない。当初これを CI の環境変数（人手の注記）で受けたが、それは誤り:
 *
 * - **所有権が反転する。** 「いつ負荷が来るか」は製品が持っている情報（`SCHEDULE` シグナル）
 *   で、人間が CI 設定へ転記するものではない
 * - **決裁の場に出す数字の出所が人間になる。** 手入力の定数から出たリードタイムは、
 *   計算しているように見えて実質は申告値＝「盛らない」規律に反する
 * - **静かに腐る。** 固定日時は過ぎた瞬間から永久に負のリードタイムを出し続ける
 *
 * ## パースしてよい理由（E6-2 の「構造化を先回りしない」に抵触しない）
 *
 * 構造化を拒否したのは **`RiskItem.window`＝ LLM が生成した自由文字列**のほう。ここで読むのは
 * `ForecastSignal.kind === SCHEDULE` の `when` だけで、その値は `ScheduleSignalSource` が
 * `ScheduleSource`（seed／将来はカレンダー）の `ScheduleWindow.when` を**そのまま運んだもの**＝
 * **我々が定義した書式**であり、LLM を1度も通っていない。読めない書式は `undefined` を返して
 * 呼び出し側で縮退する（推測しない）。
 *
 * ⚠ **これは当座の形。** 恒久形は `ScheduleWindow` に機械可読な繰り返し定義を持たせ、
 * 解決済みの時刻をシグナルの wire に載せること（文字列の描画は表示の関心事）。そちらへ移ったら
 * このファイルは丸ごと消える。移行に backend デプロイと予報の再生成が要るので分けた。
 */

/** 業務スケジュールのタイムゾーン。日本は DST が無いので固定オフセットで厳密に扱える。 */
const BUSINESS_UTC_OFFSET_MINUTES = 9 * 60; // Asia/Tokyo
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000;

const WEEKDAY_INDEX: Record<string, number> = {
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

// 曜日は**独立したトークン**としてのみ拾う。"8日 20:00" の「日」を日曜と誤読しないため
// （前が行頭/空白/括弧で、後ろが「曜」「曜日」か区切り）。英語は語境界で見る。
const JA_WEEKDAY = /(?:^|[\s（(])([日月火水木金土])(?:曜日?)?(?=[\s（(]|$)/;
const EN_WEEKDAY = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i;
// HH:MM の全出現。1つめが開始、2つめがあれば終了（"土 20:00-23:00" → 20:00 と 23:00）。
const TIME_ALL = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

/** 解決できた時刻と、読み取った素材（出所をそのまま表示に出すため）。 */
export type ScheduleOccurrence = {
  /** 予報発行時刻から見て、次にこの窓が始まる瞬間（UTC の Date）。 */
  readonly startsAt: Date;
  /**
   * 窓が終わる瞬間。**終了時刻が書かれていなければ付かない**——長さを勝手に決めない
   * （帯の幅を捏造しないための欠落）。開始より前なら日跨ぎとして翌日に送る。
   */
  readonly endsAt?: Date;
  /** 解決の元になった文字列（`ScheduleWindow.when` そのもの）。 */
  readonly source: string;
};

/**
 * `when`（例 "土 20:00-23:00" / "Sat 20:00-23:00"）を、`issuedAt` 以降で**最初に到来する**
 * 開始時刻へ解決する。曜日と開始時刻の両方が読めなければ `undefined`（推測しない）。
 */
export function resolveScheduleOccurrence(
  when: string,
  issuedAt: Date,
): ScheduleOccurrence | undefined {
  const weekday = parseWeekday(when);
  const times = [...when.matchAll(TIME_ALL)].map((m) => ({
    hour: Number(m[1]),
    minute: Number(m[2]),
  }));
  const start = times[0];
  if (weekday === undefined || !start) return undefined;

  // 業務ローカル時刻での計算に持ち込む（+9h ずらし、以後 UTC ゲッタを「現地の暦」として読む）。
  const localNow = new Date(issuedAt.getTime() + OFFSET_MS);
  const todayAtTime = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
    start.hour,
    start.minute,
  );
  const daysAhead = (weekday - new Date(todayAtTime).getUTCDay() + 7) % 7;
  let candidate = todayAtTime + daysAhead * DAY_MS;
  // 同じ曜日でも時刻を過ぎていれば翌週（「次に来る窓」が定義）。
  if (candidate < localNow.getTime()) candidate += 7 * DAY_MS;

  const end = times[1];
  let endLocal: number | undefined;
  if (end) {
    endLocal = candidate + ((end.hour - start.hour) * 60 + (end.minute - start.minute)) * 60_000;
    if (endLocal <= candidate) endLocal += DAY_MS; // 日跨ぎ（例 22:00-02:00）
  }

  return {
    startsAt: new Date(candidate - OFFSET_MS),
    ...(endLocal !== undefined ? { endsAt: new Date(endLocal - OFFSET_MS) } : {}),
    source: when,
  };
}

function parseWeekday(when: string): number | undefined {
  const ja = JA_WEEKDAY.exec(when);
  if (ja) return WEEKDAY_INDEX[ja[1] as string];
  const en = EN_WEEKDAY.exec(when);
  if (en) return WEEKDAY_INDEX[(en[1] as string).toLowerCase()];
  return undefined;
}
