import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import { SimilarIncidentRepository } from "../../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
  MatchedCondition,
} from "../../AlertClassification.js";
import { ClassificationRule } from "../ClassificationRule.js";
import { ClassificationRuleKind } from "../ClassificationRuleKind.js";

// この確度未満は棄権（null）して下位 Rule（AI推論）にフォールバックさせる
const DEFAULT_MIN_CONFIDENCE = 0.6;
// raw score を [0,1] に正規化する飽和点。score >= ceiling で confidence 1.0。
// バックエンド依存（cosine/RRF は 1 付近、BM25 は数十）なので composition root で調整する。
const DEFAULT_SCORE_CEILING = 1;
// 1イベントあたり評価する検索ヒット数の上限
const DEFAULT_LIMIT = 5;

// 過去の解決済みインシデントへの「類似度」で分類する Rule（graded confidence の本体）。
// 完全一致でなくても「過去のDB枯渇に82%類似・確度 中」のような確度を返す = 連続スペクトル分類。
// 検索バックエンド（Elastic 等）は SimilarIncidentRepository.search として内包し、ここはスコア正規化と
// 閾値による棄権・分類結果の組み立てという「意思決定」に専念する（バックエンドのスコア尺度を domain に漏らさない）。
export class SimilarPatternRule implements ClassificationRule {
  readonly kind = ClassificationRuleKind.SIMILARITY;

  constructor(
    private readonly similarIncidents: SimilarIncidentRepository,
    private readonly minConfidence: number = DEFAULT_MIN_CONFIDENCE,
    private readonly scoreCeiling: number = DEFAULT_SCORE_CEILING,
    private readonly limit: number = DEFAULT_LIMIT,
  ) {}

  async classify(
    monitoringEvent: MonitoringEvent,
  ): Promise<KnownAlertClassification | null> {
    const matches = await this.similarIncidents.search({
      eventName: monitoringEvent.eventName,
      text: this.buildQueryText(monitoringEvent),
      limit: this.limit,
    });
    if (matches.length === 0) {
      return null;
    }

    // バックエンドが降順を保証しない場合に備え、最も類似度の高いヒットを明示的に取る
    const best = matches.reduce((a, b) => (b.score > a.score ? b : a));
    const confidenceValue = this.normalize(best.score);

    // 閾値未満は棄権（この Rule では分類しない＝下位 Rule に委ねる）
    if (confidenceValue < this.minConfidence) {
      return null;
    }

    const matchedConditions: MatchedCondition[] = [
      {
        field: "eventName",
        expectedValue: best.incident.eventName,
        actualValue: monitoringEvent.eventName,
      },
      {
        field: "similarity",
        expectedValue: `>=${this.minConfidence}`,
        actualValue: confidenceValue,
      },
    ];

    return {
      type: "known",
      source: this.kind,
      // KnownErrorPattern ではなく解決済みインシデント参照であることを id 接頭辞で明示
      patternId: `similar:${best.incident.id}`,
      patternName: `類似既知: ${best.incident.eventName}`,
      severity: best.incident.severity,
      confidence: ClassificationConfidence.of(confidenceValue),
      matchedConditions,
      unmatchedConditions: [],
      // 元になった解決済み Alert への back-link（あれば）。フロントは「過去の同型障害」へ
      // 内部遷移（/alerts/:id）する動線に使う。古い索引には未保持なこともあるので任意。
      ...(best.incident.sourceAlertId !== undefined
        ? { sourceAlertId: best.incident.sourceAlertId }
        : {}),
      // 一致した事例の対応メモ（当時どう直したか）。「なぜ準・既知か」の根拠と併せて
      // 「前回の対応」をその場で見せる表示面に使う（空文字は載せない）。
      ...(best.incident.resolvedNote !== ""
        ? { resolvedNote: best.incident.resolvedNote }
        : {}),
    };
  }

  // 生スコアを飽和点で割って [0,1] にクランプする（単調・決定的・バックエンド非依存）
  private normalize(rawScore: number): number {
    const normalized = rawScore / this.scoreCeiling;
    return Math.max(0, Math.min(1, normalized));
  }

  // eventName と payload からハイブリッド検索用の自由文を組み立てる。
  //
  // 発生毎に変わる高カーディナリティ値（UUID・数量・金額・ID配列）は除外する。
  // これらは「再発した同種障害」を語る語彙ではなく、毎回ユニークなトークンとして
  // Jaccard の和集合だけを膨らませるノイズ。実イベントは orderId/customerId の
  // UUID 2つだけで類似度上限が約0.5に潰れ、しきい値0.6に構造的に届かなくなる
  // （＝実経路の再発が永遠に類似一致しない）。障害の語彙を運ぶのは reason/symptom 等の
  // 文字列フィールドなので、UUID 形式でない文字列値だけをクエリに載せる。
  private buildQueryText(event: MonitoringEvent): string {
    const payloadText = Object.entries(event.payload)
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && !UUID_PATTERN.test(entry[1]),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    return `${event.eventName} ${payloadText}`.trim();
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
