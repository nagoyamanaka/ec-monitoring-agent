import { Type, type Schema } from "@google/genai";

/**
 * 調査レポート JSON の構造化出力スキーマ（Gemini `responseSchema`＝制約付きデコード）。
 *
 * `LLMOutputParser.LLMInvestigationOutput` の**出力側の双子**。パーサが「受け取った文字列を
 * 検証して落とす」のに対し、こちらは「そもそも不正な形を生成させない」。両者がずれると
 * 「スキーマ通りに生成したのにパーサが弾く」という無言の事故になるため、必須フィールドの
 * 一致は UT（investigationResponseSchema.test.ts）で固定する。
 *
 * 用途は finalizer（`GeminiInvestigationFinalizer`）＝ツールなし・思考最小の単発呼び出し。
 * ADK のコーディネーターには付けられない（`responseSchema` は関数呼び出しと併用不可）ので、
 * 「熟考する仕事」と「JSON を書き出す仕事」を分けた後段にだけ効かせる（ADR-26 恒久策）。
 *
 * 任意フィールド（impact / escalation / remediationReview）を `required` に入れないのは、
 * 「根拠が無ければ項目ごと省く」というこのシステムの一貫した方針のため。生成されてしまった
 * 場合の空証拠ガード（citations 空 → impact 破棄 / team 空 → escalation 破棄）はマッパ側に残る。
 */

const STRING_ARRAY: Schema = { type: Type.ARRAY, items: { type: Type.STRING } };

/** citations / evidenceBundle。引用は citableIds の逐語コピーだけを許す方針の再掲（description で圧をかける）。 */
const CITATION_ARRAY: Schema = {
  type: Type.ARRAY,
  description:
    "根拠として参照した証拠の id。入力 citableIds に含まれる文字列を一字一句そのままコピーする。装飾・説明・充填値(N/A)は禁止。",
  items: { type: Type.STRING },
};

export const INVESTIGATION_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "障害の説明（日本語・1〜2文）。",
    },
    confidence: {
      type: Type.NUMBER,
      description:
        "0〜1。結論をどれだけ証拠で裏付けられたかの中立な自己評価（大きく見せる値ではない）。",
      minimum: 0,
      maximum: 1,
    },
    severity: {
      type: Type.STRING,
      format: "enum",
      enum: ["CRITICAL", "WARNING", "INFO"],
    },
    investigationSteps: STRING_ARRAY,
    suggestedActions: STRING_ARRAY,
    suggestedPatternName: {
      type: Type.STRING,
      description:
        "自動昇格候補のパターン名（UPPER_SNAKE_CASE・必ず非空。確定できない場合も最有力仮説の名前を出す）。",
      minLength: "1",
    },
    remediable: {
      type: Type.BOOLEAN,
      description: "自社コードの変更（依存更新・設定/コード修正）で直せ、PR 起票で対処可能なら true。",
    },
    relatedAlerts: {
      type: Type.ARRAY,
      description: "共有証拠で裏付けられる関連アラートのみ。無ければ空配列。",
      items: {
        type: Type.OBJECT,
        properties: {
          alertId: { type: Type.STRING },
          relation: {
            type: Type.STRING,
            format: "enum",
            enum: ["same_root_cause", "downstream", "upstream", "precursor", "similar"],
          },
          rationale: { type: Type.STRING },
          citations: CITATION_ARRAY,
        },
        required: ["alertId", "relation", "rationale", "citations"],
        propertyOrdering: ["alertId", "relation", "rationale", "citations"],
      },
    },
    impact: {
      type: Type.OBJECT,
      description: "今回の障害ぶんの影響評価。citations を出せない場合はこのフィールドごと省略する。",
      properties: {
        fault: {
          type: Type.STRING,
          format: "enum",
          enum: ["own", "external", "unknown"],
        },
        scope: { type: Type.STRING },
        scale: { type: Type.STRING },
        affectedSubjects: STRING_ARRAY,
        citations: CITATION_ARRAY,
      },
      required: ["fault", "scope", "scale", "affectedSubjects", "citations"],
      propertyOrdering: ["fault", "scope", "scale", "affectedSubjects", "citations"],
    },
    escalation: {
      type: Type.OBJECT,
      description:
        "他責/運用案件の引き継ぎ草案。team は体制マスタから引けた宛先のみ（捏造禁止・引けなければこのフィールドごと省略）。",
      properties: {
        team: { type: Type.STRING },
        owner: { type: Type.STRING },
        contact: { type: Type.STRING },
        reason: { type: Type.STRING },
        interimWorkaround: { type: Type.STRING },
        severityRationale: { type: Type.STRING },
        evidenceBundle: CITATION_ARRAY,
      },
      required: [
        "team",
        "owner",
        "contact",
        "reason",
        "interimWorkaround",
        "severityRationale",
        "evidenceBundle",
      ],
      propertyOrdering: [
        "team",
        "owner",
        "contact",
        "reason",
        "interimWorkaround",
        "severityRationale",
        "evidenceBundle",
      ],
    },
    remediationReview: {
      type: Type.OBJECT,
      description:
        "起票済み修正PRのレビュー結果。対象 PR が無い（未起票）場合はこのフィールドごと省略する。",
      properties: {
        verdict: {
          type: Type.STRING,
          format: "enum",
          enum: ["pass", "concerns", "reject"],
        },
        concerns: STRING_ARRAY,
        pullRequestUrl: { type: Type.STRING },
        citations: CITATION_ARRAY,
      },
      required: ["verdict", "concerns", "pullRequestUrl", "citations"],
      propertyOrdering: ["verdict", "concerns", "pullRequestUrl", "citations"],
    },
  },
  // パーサ（parseLLMOutput）が必須判定している6項目＋「省略と空の区別が要らない」2項目。
  // remediable / relatedAlerts を必須にするのは、未指定を false / [] に丸める現行挙動と
  // 「モデルが明示的に決めた false / []」を同じ扱いにできるため（安全側の丸めが不要になる）。
  required: [
    "summary",
    "confidence",
    "severity",
    "investigationSteps",
    "suggestedActions",
    "suggestedPatternName",
    "remediable",
    "relatedAlerts",
  ],
  propertyOrdering: [
    "summary",
    "confidence",
    "severity",
    "investigationSteps",
    "suggestedActions",
    "suggestedPatternName",
    "remediable",
    "relatedAlerts",
    "impact",
    "escalation",
    "remediationReview",
  ],
};
