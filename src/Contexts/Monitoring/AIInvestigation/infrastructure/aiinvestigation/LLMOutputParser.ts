import type {
  RelatedAlertPrimitives,
  ImpactAssessmentPrimitives,
  ImpactFault,
  EscalationDraftPrimitives,
} from "../../../AlertAnalysis/domain/contracts/AlertContract.js";

/**
 * LLMの生テキスト出力を、検証済みの構造化スキーマへ変換する（プロバイダ非依存）。
 * ```json フェンス／素のJSONどちらにも対応し、スキーマ不一致・パース失敗時は null を返す。
 */

/** LLMに固定出力させる調査結果のスキーマ。 */
export type LLMInvestigationOutput = {
  summary: string;
  confidence: number;
  severity: string;
  investigationSteps: string[];
  suggestedActions: string[];
  suggestedPatternName: string;
  // 「コードで直せるか」の AI 判定。未指定・型不正は false に丸める（必須スキーマには含めない）。
  remediable: boolean;
  // AI が見つけた相関アラート（id・関係・根拠）。未指定・型不正は空配列に丸める。
  relatedAlerts: RelatedAlertPrimitives[];
  // 影響評価（自責他責・影響範囲・障害規模）。未指定・構造不正は undefined（必須スキーマには含めない）。
  // citations 空の影響主張を落とすハルシネーションガードはマッパ側（toInvestigationReport）。
  impact?: ImpactAssessmentPrimitives;
  // 他責/運用案件のエスカレーション草案。未指定・構造不正は undefined（必須スキーマには含めない）。
  // team 空（宛先を引けない＝捏造）を落とすガードはマッパ側（toInvestigationReport）。
  escalation?: EscalationDraftPrimitives;
};

const VALID_FAULTS: ReadonlySet<string> = new Set<ImpactFault>(["own", "external", "unknown"]);

/**
 * 配列要素を文字列のみへ正規化する。LLM が誤って文字列以外（オブジェクト・数値）を混ぜても
 * 落とす防御。href/kind はここでは受け取らない（リンクは LLM ではなく evidence から決定的に
 * 導出する＝ハルシネーション URL を排除する。`evidenceLinks` 参照）。
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * relatedAlerts を {alertId, relation, rationale} の配列へ正規化する。
 * 3 フィールドが揃った文字列要素のみ残す（型不正・欠落・配列でない場合は空配列）。
 * alertId の実在性（candidateAlerts に含まれるか）はここでは検証しない＝表示側で解決し、
 * 未解決はリンクのみ出す（フロント `toRelatedAlertViews`）。
 */
function toRelatedAlerts(value: unknown): RelatedAlertPrimitives[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item === null || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    if (
      typeof o["alertId"] === "string" &&
      typeof o["relation"] === "string" &&
      typeof o["rationale"] === "string"
    ) {
      return [
        {
          alertId: o["alertId"],
          relation: o["relation"],
          rationale: o["rationale"],
        },
      ];
    }
    return [];
  });
}

/**
 * impact を {fault, scope, scale, affectedSubjects, citations} へ正規化する。
 * scope/scale が文字列で揃っていない・object でない場合は undefined（影響評価なし）。
 * fault は own/external/unknown のみ許容し、未知値は安全側で "unknown" に丸める。
 * citations は空白文字列を除いて配列化（id 参照の純度を上げる）。空 citations の影響を
 * 落とすガードはここではなくマッパ側（証拠なき主張を「表示前に落とす」のは表示寄りの関心事）。
 */
function toImpact(value: unknown): ImpactAssessmentPrimitives | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  if (typeof o["scope"] !== "string" || typeof o["scale"] !== "string") return undefined;
  const rawFault = o["fault"];
  const fault: ImpactFault =
    typeof rawFault === "string" && VALID_FAULTS.has(rawFault) ? (rawFault as ImpactFault) : "unknown";
  return {
    fault,
    scope: o["scope"],
    scale: o["scale"],
    affectedSubjects: toStringArray(o["affectedSubjects"]),
    citations: toStringArray(o["citations"]).filter((c) => c.trim() !== ""),
  };
}

/** 文字列フィールドを安全に取り出す。非文字列・欠落は空文字に丸める。 */
function toStringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * escalation を {team, owner, contact, reason, interimWorkaround, severityRationale, evidenceBundle} へ
 * 正規化する。object でなければ undefined（エスカレーション草案なし）。各文字列フィールドは欠落・非文字列を
 * 空文字に丸め、evidenceBundle は文字列要素のみ残す。team 空（宛先を引けなかった＝捏造）を落とすガードは
 * マッパ側（証拠なき宛先を「表示前に落とす」のは表示寄りの関心事。impact の citations 空ガードと同方針）。
 */
function toEscalation(value: unknown): EscalationDraftPrimitives | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  return {
    team: toStringField(o["team"]),
    owner: toStringField(o["owner"]),
    contact: toStringField(o["contact"]),
    reason: toStringField(o["reason"]),
    interimWorkaround: toStringField(o["interimWorkaround"]),
    severityRationale: toStringField(o["severityRationale"]),
    evidenceBundle: toStringArray(o["evidenceBundle"]).filter((c) => c.trim() !== ""),
  };
}

export function parseLLMOutput(text: string): LLMInvestigationOutput | null {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(jsonStr.trim()) as Record<string, unknown>;

    if (
      typeof parsed["summary"] !== "string" ||
      typeof parsed["confidence"] !== "number" ||
      typeof parsed["severity"] !== "string" ||
      !Array.isArray(parsed["investigationSteps"]) ||
      !Array.isArray(parsed["suggestedActions"]) ||
      typeof parsed["suggestedPatternName"] !== "string"
    ) {
      return null;
    }

    return {
      summary: parsed["summary"] as string,
      confidence: parsed["confidence"] as number,
      severity: parsed["severity"] as string,
      investigationSteps: toStringArray(parsed["investigationSteps"]),
      suggestedActions: toStringArray(parsed["suggestedActions"]),
      suggestedPatternName: parsed["suggestedPatternName"] as string,
      remediable: parsed["remediable"] === true,
      relatedAlerts: toRelatedAlerts(parsed["relatedAlerts"]),
      impact: toImpact(parsed["impact"]),
      escalation: toEscalation(parsed["escalation"]),
    };
  } catch {
    return null;
  }
}
