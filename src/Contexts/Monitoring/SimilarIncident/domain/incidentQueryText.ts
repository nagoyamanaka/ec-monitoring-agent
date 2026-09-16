import { MonitoringEvent } from "../../Shared/domain/MonitoringEvent.js";

// 字句類似（Jaccard）の突合に使う「イベント側の本文」。分類時のクエリと承認時の索引（searchText）で
// **同じ関数**を使うことが要点＝突合キーを両側で揃える。索引側だけ resolvedNote（和文の対処メモ）に
// していると、payload トークンと和文 bigram はほぼ重ならず、実運用で承認した事例は再発しても
// 閾値に届かない（seed の searchText は手で英語トークンにしてあるので当たる、という非対称）。
//
// 発生毎に変わる高カーディナリティ値（UUID・数量・金額・ID配列）は除外する。
// これらは「再発した同種障害」を語る語彙ではなく、毎回ユニークなトークンとして
// Jaccard の和集合だけを膨らませるノイズ。実イベントは orderId/customerId の
// UUID 2つだけで類似度上限が約0.5に潰れ、しきい値0.6に構造的に届かなくなる
// （＝実経路の再発が永遠に類似一致しない）。障害の語彙を運ぶのは reason/symptom 等の
// 文字列フィールドなので、UUID 形式でない文字列値だけを載せる。
export function buildIncidentQueryText(event: MonitoringEvent): string {
  const payloadText = Object.entries(event.payload)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && !UUID_PATTERN.test(entry[1]),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  return `${event.eventName} ${payloadText}`.trim();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
