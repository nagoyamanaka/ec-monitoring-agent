import type {
  RelatedAlertPrimitives,
  ImpactAssessmentPrimitives,
  ImpactFault,
  EscalationDraftPrimitives,
  RemediationReviewPrimitives,
  RemediationVerdict,
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
  // 修正PRの自動レビュー結果。未指定・構造不正は undefined（必須スキーマには含めない）。
  // pullRequestUrl 空（レビュー対象 PR を引けない＝何をレビューしたか不明）を落とすガードはマッパ側。
  remediationReview?: RemediationReviewPrimitives;
};

const VALID_FAULTS: ReadonlySet<string> = new Set<ImpactFault>(["own", "external", "unknown"]);

const VALID_VERDICTS: ReadonlySet<string> = new Set<RemediationVerdict>([
  "pass",
  "concerns",
  "reject",
]);

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
 * 引用として無意味な充填トークン（実機で "N/A" を観測＝タスク D6）。「citation 必須」の圧で
 * LLM が埋める定型の空値だけを落とす。未照合の実引用は落とさない（正直さの担保は表示側のまま）。
 * 充填だけになった impact はマッパの空 citations ガードで丸ごと落ちる＝「N/A は根拠なし」と同義。
 */
const FILLER_CITATIONS = new Set(["n/a", "none", "null", "-", "なし", "特になし"]);

/** 引用系配列（citations / evidenceBundle）の取り込み: 文字列のみ・空白のみと充填トークンを除く。 */
function toCitationArray(value: unknown): string[] {
  return toStringArray(value).filter(
    (c) => c.trim() !== "" && !FILLER_CITATIONS.has(c.trim().toLowerCase()),
  );
}

/**
 * relatedAlerts を {alertId, relation, rationale, citations} の配列へ正規化する。
 * 3 フィールドが揃った文字列要素のみ残す（型不正・欠落・配列でない場合は空配列）。
 * citations は空白文字列を除いて配列化（欠落・非配列は空配列＝根拠なし）。
 * alertId の実在性（candidateAlerts に含まれるか）はここでは検証しない＝表示側で解決し、
 * 未解決はリンクのみ出す（フロント `toRelatedAlertViews`）。citations が収集済み証拠に
 * 解決しない関連を落とすガードはマッパ側（impact の citations 空ガードと同方針）。
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
          citations: toCitationArray(o["citations"]),
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
    citations: toCitationArray(o["citations"]),
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
    evidenceBundle: toCitationArray(o["evidenceBundle"]),
  };
}

/**
 * remediationReview を {verdict, concerns, pullRequestUrl, citations} へ正規化する。
 * object でなければ undefined（レビュー結果なし）。verdict は pass/concerns/reject のみ許容し、
 * 未知値・欠落は安全側（自動 pass させない）で "concerns" に丸める。concerns/citations は空白文字列を除いて
 * 配列化。pullRequestUrl 空（レビュー対象 PR を引けなかった＝何をレビューしたか不明）の review を落とす
 * ガードはマッパ側（根拠なき verdict を「表示前に落とす」のは表示寄りの関心事。impact/escalation と同方針）。
 */
function toRemediationReview(value: unknown): RemediationReviewPrimitives | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  const rawVerdict = o["verdict"];
  const verdict: RemediationVerdict =
    typeof rawVerdict === "string" && VALID_VERDICTS.has(rawVerdict)
      ? (rawVerdict as RemediationVerdict)
      : "concerns";
  return {
    verdict,
    concerns: toStringArray(o["concerns"]).filter((c) => c.trim() !== ""),
    pullRequestUrl: toStringField(o["pullRequestUrl"]),
    citations: toCitationArray(o["citations"]),
  };
}

/**
 * パース不能で fallback に落ちた際、生出力の先頭を Cloud Logging に安全に残すための1行スニペット化。
 * 改行・連続空白を単一スペースに潰して1行にし、先頭 max 文字で頭打ちにする（ログ肥大とPII/巨大diff流出を抑える）。
 * rawLen と併せて「JSON でなく散文が返ったか」「途中で切れたか」を本番で判別する材料にする。
 */
export function rawSnippet(text: string, max = 500): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
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
      remediationReview: toRemediationReview(parsed["remediationReview"]),
    };
  } catch {
    return null;
  }
}

/** 修復のための括弧スタック1段。afterColon はオブジェクト内で「次の文字列は値」を判別する。 */
type ContainerFrame = { char: "{" | "["; afterColon: boolean };

/**
 * 途中で切断された JSON テキストを「最後に完成した値」まで巻き戻し、開いたままの括弧を
 * 閉じて構文的に完全な JSON へ修復する（fallback 第4原因＝最終出力の mid-string 切断への防御）。
 *
 * 文字列中の括弧・エスケープを状態機械で追跡し、値（文字列・数値・リテラル・入れ子の閉じ）が
 * 完成するたびにその位置と未クローズ括弧をスナップショットする。オブジェクトのキー文字列の
 * 直後では切らない（`{"key"` + 閉じ括弧は不正な JSON になるため）。
 * JSON が始まらない・値が1つも完成していない・括弧が対応しない場合は null。
 */
function repairTruncatedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  const s = text.slice(start);
  const stack: ContainerFrame[] = [];
  let inString = false;
  let escaped = false;
  let stringIsValue = false;
  let cutEnd = -1;
  let cutStack: ContainerFrame["char"][] = [];

  const snapshot = (end: number): void => {
    cutEnd = end;
    cutStack = stack.map((frame) => frame.char);
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (c === '"') {
        inString = false;
        if (stringIsValue) snapshot(i + 1);
      }
      continue;
    }
    switch (c) {
      case '"': {
        const top = stack[stack.length - 1];
        inString = true;
        stringIsValue = !top || top.char === "[" || top.afterColon;
        break;
      }
      case "{":
      case "[":
        stack.push({ char: c, afterColon: false });
        break;
      case "}":
      case "]":
        if (stack.length === 0) return null;
        stack.pop();
        snapshot(i + 1);
        break;
      case ":": {
        const top = stack[stack.length - 1];
        if (top?.char === "{") top.afterColon = true;
        break;
      }
      case ",": {
        const top = stack[stack.length - 1];
        if (top?.char === "{") top.afterColon = false;
        // カンマ直前＝直前の値（数値・true/false/null を含む）の完成点。カンマ自体は含めない。
        snapshot(i);
        break;
      }
      default:
        break;
    }
  }

  if (cutEnd <= 0) return null;
  const closers = cutStack
    .reverse()
    .map((c) => (c === "{" ? "}" : "]"))
    .join("");
  return s.slice(0, cutEnd) + closers;
}

/**
 * 途切れた LLM 出力から完成済みフィールドを best-effort で回収するサルベージパース。
 *
 * parseLLMOutput が null（切断で構文不正／必須フィールド未達）でも、summary さえ完成して
 * いれば部分レポートとして成立させる（fallback の「自動調査に失敗しました」より、正しい
 * 分析の断片を見せる方が価値が高い）。summary を回収できない場合は null＝fallback が正直。
 * 欠けたフィールドは安全側の既定値に丸める（confidence=0・severity はマッパ側で WARNING に丸む）。
 */
export function salvageLLMOutput(text: string): LLMInvestigationOutput | null {
  const repaired = repairTruncatedJson(text);
  if (repaired === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o["summary"] !== "string" || o["summary"].trim() === "") return null;

  return {
    summary: o["summary"],
    confidence: typeof o["confidence"] === "number" ? o["confidence"] : 0,
    severity: toStringField(o["severity"]),
    investigationSteps: toStringArray(o["investigationSteps"]),
    suggestedActions: toStringArray(o["suggestedActions"]),
    suggestedPatternName: toStringField(o["suggestedPatternName"]),
    remediable: o["remediable"] === true,
    relatedAlerts: toRelatedAlerts(o["relatedAlerts"]),
    impact: toImpact(o["impact"]),
    escalation: toEscalation(o["escalation"]),
    remediationReview: toRemediationReview(o["remediationReview"]),
  };
}
