import { randomUUID } from "node:crypto";
import { Logger } from "../../../Shared/domain/logging/Logger.js";
import { LLMTextClient } from "../../AIInvestigation/domain/LLMTextClient.js";
import { ForecastContext } from "../domain/ForecastContext.js";
import { ForecastPort } from "../domain/ForecastPort.js";
import { RiskForecast, RiskItem, RiskLevel } from "../domain/RiskForecast.js";

/**
 * ForecastPort の実装（単発 Gemini 経路・ADK 非使用は意図的な設計判断）。
 * 予報の入力（シグナル）は Handler が Source 群から事前収集済みで、LLM の仕事は
 * 「突合して格付ける」1ショット合成のみ＝ツールコール型の動的探索（ADK の価値）が不要。
 * responseMimeType=application/json を強制できる generateContent 直の方が、無人閲覧
 * （デプロイURL審査）に求められる構造化の堅さ・レイテンシ・課金のすべてで有利。
 * プロバイダ固有の関心事（Vertex/AI Studio 切替・タイムアウト・リトライ）は注入される
 * LLMTextClient（GeminiLLMClient）が持ち、本クラスはプロンプト構築 → 呼び出し →
 * safeParse → クランプ → fallback のオーケストレーションのみ（継承ではなくコンポジション）。
 */

// LLM に固定出力させる予報スキーマ。citations 必須（シグナル id で裏付けられない
// リスクは出させない）をプロンプトで強制する。実在照合は F5（引用検証）の責務。
const SYSTEM_INSTRUCTION = `あなたはECシステムの予兆ブリーフィングAIです。
提供された未来シグナル（未マージPR / 未適用インフラ変更 / 業務・負荷スケジュール / 過去インシデントの記憶）を
突合し、対象期間（horizon）内に起こりうる障害リスクを必ずJSONフォーマットで回答してください。
各シグナルには id があります。各リスクの citations には、そのリスクの根拠に使ったシグナルの id を
必ず1つ以上載せてください。存在しない id を作らないこと。シグナル id で裏付けられないリスク
（推測のみのリスク）は出力しないでください。
subject にはシグナルの subject（突合キー）をそのまま使ってください。
window は「いつ危ないか」の時間窓です。引用したシグナルの when から導出してください。
level は HIGH / MEDIUM / LOW。種類の異なるシグナルが同一 subject で重なるほど
（例: 接続数を減らす変更予定 × 高負荷スケジュール × 過去の同型障害）高くしてください。
単独シグナルのみで裏付けられるリスクは原則 LOW〜MEDIUM に留めてください。
confidence（0〜1）は「リスクをどれだけシグナルで裏付けられたか」の中立な自己評価です。
実際に引用したシグナルの強さだけを反映し、過大評価しないこと。
risks は level 降順で並べ、対象期間内にリスクが無ければ空配列を返してください（無理に作らない）。
reasoning には引用シグナルを踏まえた根拠を日本語2〜3文で書いてください。
reasoning は診断に徹し、対処の提案は書かないこと。
まず「なぜ危ないか」の因果連鎖を、引用シグナルの中身に即して具体的に説明してください＝
各シグナルが何をもたらし（例: 接続プールを縮小する変更で上限が下がる／週末セールで
checkout 接続が急増する／過去も同じ経路で枯渇した実績がある）、それらがどう連鎖して
同じ障害（例: 接続プール枯渇）に至るのかを書く。これが「なぜ HIGH か」の本体です。
level が HIGH / MEDIUM のときは、その連鎖の締めで「種類の異なる複数の根拠（未来の変更・
高負荷・過去の同型など）が独立に同じ帰結を指している」ことに触れ、確度の高さを根拠づける。
ただし機構の説明を省いて「N種類が収束するため HIGH」とだけ数える定型文は禁止です
（件数の可視化は UI 側が担うので、文章は必ず因果の中身を語ること）。
preventiveAction には「発火自体を防ぐために人間が今打てる先手」を
「〜することを推奨します」の形の日本語で書いてください。
その中に「その先手を実行すると何が防げるか」＝防げる再発の型と、それを外に出す対象の
時間窓（引用した window）を必ず1文含めてください（合計1〜2文）
（例: 該当PR（pr-55）のマージを週末セール（土20:00-23:00）後へ延期することを推奨します。
これにより同型の接続プール枯渇の再発を高負荷窓の外へ外せます）。
必ず citations に載せた実在シグナルに言及する具体的な先手にすること。
実行主体は人間です。「システムが自動で防ぐ」とは書かないこと。
HIGH・MEDIUM のリスクには原則 preventiveAction を必ず出してください。
具体的な先手がどうしても無いリスクに限り省略できます（捏造はしない）。
なお下の JSON 例の confidence 値（0.7）は出力形式の見本であり、目標値ではありません。
{
  "risks": [
    {
      "window": "土 20:00-23:00",
      "subject": "db_connection_pool",
      "level": "HIGH" | "MEDIUM" | "LOW",
      "confidence": 0.7,
      "citations": ["chg-1", "sch-1", "inc-7"],
      "reasoning": "接続数を減らす変更予定（chg-1）で接続プールの上限が下がるところに、週末セールの高負荷（sch-1）で checkout 接続が急増し、過去も同じ経路で枯渇した実績（inc-7）がある。未来の変更・高負荷・過去の同型という独立した根拠がいずれも同じ接続プール枯渇を指すため HIGH。",
      "preventiveAction": "該当の変更（chg-1）の適用を高負荷スケジュール（sch-1・土20:00-23:00）後へ延期することを推奨します。これにより同型の接続プール枯渇の再発を高負荷窓の外へ外せます。"
    }
  ]
}`;

// url は推論に不要（リンク解決はフロントが citation → シグナルの url で行う）ため
// LLM には渡さない＝トークン節約と URL エコーバック（ハルシネーション URL）の抑止。
export function buildForecastPrompt(context: ForecastContext): string {
  const signals = context.signals.map((s) => ({
    id: s.id,
    kind: s.kind,
    subject: s.subject,
    when: s.when,
    desc: s.desc,
    source: s.source,
  }));
  return `対象期間（horizon）: ${context.horizon}

シグナル一覧:
${JSON.stringify(signals, null, 2)}`;
}

const LEVEL_ORDER: Record<RiskLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

const VALID_LEVELS: ReadonlySet<string> = new Set<RiskLevel>(["HIGH", "MEDIUM", "LOW"]);

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0.0, Math.min(1.0, value));
}

/** 未知の level は安全側（リスクを盛らない）で LOW に丸める。 */
function toLevel(value: unknown): RiskLevel {
  return typeof value === "string" && VALID_LEVELS.has(value) ? (value as RiskLevel) : RiskLevel.LOW;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

/**
 * risks 配列の要素を RiskItem に正規化する。window/subject/reasoning が文字列で揃わない・
 * subject 空（突合キー無し＝引用検証もフロント表示も成立しない）要素は落とす。
 * citations 空の要素はここでは落とさない＝「空は不正」を落とすのは F5 引用検証の責務
 * （実在照合と同じ場所に集約し、ガードの二重実装を避ける）。
 */
function toRiskItems(value: unknown): RiskItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.flatMap((item): RiskItem[] => {
    if (item === null || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    if (
      typeof o["window"] !== "string" ||
      typeof o["subject"] !== "string" ||
      o["subject"].trim() === "" ||
      typeof o["reasoning"] !== "string"
    ) {
      return [];
    }
    // 先手（F11a）は optional: 文字列以外・空白のみはフィールドごと落とす＝
    // 出なくてもリスク自体は残り、カードは先手行なしで成立する（優雅な縮退）。
    const preventiveAction =
      typeof o["preventiveAction"] === "string" && o["preventiveAction"].trim() !== ""
        ? o["preventiveAction"].trim()
        : undefined;
    return [
      {
        window: o["window"],
        subject: o["subject"],
        level: toLevel(o["level"]),
        confidence: clampConfidence(o["confidence"]),
        citations: toStringArray(o["citations"]),
        reasoning: o["reasoning"],
        ...(preventiveAction ? { preventiveAction } : {}),
      },
    ];
  });
  // level 降順（同 level は confidence 降順）＝ RiskForecast.risks の契約はここで保証する。
  return items.sort(
    (a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level] || b.confidence - a.confidence,
  );
}

/** ```json フェンス／素のJSONどちらにも対応。スキーマ不一致・パース失敗は null。 */
export function parseForecastOutput(text: string): RiskItem[] | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(jsonStr.trim()) as Record<string, unknown>;
    return toRiskItems(parsed["risks"]);
  } catch {
    return null;
  }
}

/** パース不能時に生出力の先頭を Cloud Logging へ1行で残す（散文か途中切断かの判別材料）。 */
function rawSnippet(text: string, max = 500): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function buildFallbackForecast(horizon: string): RiskForecast {
  return {
    forecastId: randomUUID(),
    generatedAt: new Date(),
    horizon,
    risks: [],
    isFallback: true,
  };
}

export class GeminiForecastAdapter implements ForecastPort {
  constructor(
    private readonly llm: LLMTextClient,
    // 予報失敗（LLM 例外／パース不能）を観測するロガー（任意）。未注入なら無言（UT 既定）。
    private readonly logger?: Logger,
  ) {}

  async forecast(context: ForecastContext): Promise<RiskForecast> {
    let raw: string;
    try {
      raw = await this.llm.generate(SYSTEM_INSTRUCTION, buildForecastPrompt(context));
    } catch (error) {
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "forecast_generation_failed",
        message: `予報生成がLLM例外でfallbackに落ちました: horizon=${context.horizon}, signals=${context.signals.length}, error=${error instanceof Error ? error.message : String(error)}`,
      });
      return buildFallbackForecast(context.horizon);
    }

    const risks = parseForecastOutput(raw);
    if (!risks) {
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "forecast_unparseable",
        message: `予報応答をパースできずfallbackに落ちました: horizon=${context.horizon}, rawLen=${raw.length}, rawSnippet=${rawSnippet(raw)}`,
      });
      return buildFallbackForecast(context.horizon);
    }

    return {
      forecastId: randomUUID(),
      generatedAt: new Date(),
      horizon: context.horizon,
      risks,
      isFallback: false,
    };
  }
}
