import { describe, it, expect } from "vitest";
import { INVESTIGATION_RESPONSE_SCHEMA } from "./investigationResponseSchema.js";
import { parseLLMOutput } from "./LLMOutputParser.js";

/**
 * 構造化出力スキーマ（生成側）とパーサ（検証側）の噛み合わせを固定する。
 * ずれると「スキーマ通りに生成したのにパーサが弾いて fallback」という無言の事故になり、
 * しかも本番ログでは "unparseable" としか見えない（原因が最も追いにくい形の退行）。
 */
describe("INVESTIGATION_RESPONSE_SCHEMA", () => {
  /** parseLLMOutput が非 null を返すために型検査している必須フィールド（LLMOutputParser の判定と対）。 */
  const PARSER_REQUIRED = [
    "summary",
    "confidence",
    "severity",
    "investigationSteps",
    "suggestedActions",
    "suggestedPatternName",
  ];

  it("パーサが必須判定する全フィールドを required に含む（構造化出力が省略できない）", () => {
    const required = INVESTIGATION_RESPONSE_SCHEMA.required ?? [];
    for (const field of PARSER_REQUIRED) {
      expect(required).toContain(field);
    }
  });

  it("required だけを埋めた最小の応答がパーサを通る", () => {
    const minimal = {
      summary: "DB接続枯渇",
      confidence: 0.6,
      severity: "CRITICAL",
      investigationSteps: ["ログ確認"],
      suggestedActions: ["プール拡張"],
      suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
      remediable: true,
      relatedAlerts: [],
    };

    const parsed = parseLLMOutput(JSON.stringify(minimal));

    expect(parsed).not.toBeNull();
    expect(parsed?.suggestedPatternName).toBe("DB_CONNECTION_EXHAUSTION");
    expect(parsed?.remediable).toBe(true);
  });

  it("任意フィールドまで埋めた応答が、値を落とさずパーサを通る", () => {
    const full = {
      summary: "決済プロバイダ障害",
      confidence: 0.55,
      severity: "WARNING",
      investigationSteps: ["外形監視の確認"],
      suggestedActions: ["再送キューの滞留を監視"],
      suggestedPatternName: "PAYMENT_PROVIDER_OUTAGE",
      remediable: false,
      relatedAlerts: [
        {
          alertId: "alert-1",
          relation: "same_root_cause",
          rationale: "同一の 5xx 急増を共有",
          citations: ["ec.payment.declined"],
        },
      ],
      impact: {
        fault: "external",
        scope: "決済を行う顧客",
        scale: "約120件/10分",
        affectedSubjects: ["payment"],
        citations: ["ec.payment.declined"],
      },
      escalation: {
        team: "payment-platform",
        owner: "決済基盤担当",
        contact: "#payment-platform",
        reason: "外部決済サービス起因のため運用対応が必要",
        interimWorkaround: "代替プロバイダへ切り替える",
        severityRationale: "決済成功率の低下が継続しているため",
        evidenceBundle: ["ec.payment.declined"],
      },
      remediationReview: {
        verdict: "concerns",
        concerns: ["テストが障害経路を通っていない"],
        pullRequestUrl: "https://github.com/example-org/repo/pull/1",
        citations: ["ec.payment.declined"],
      },
    };

    const parsed = parseLLMOutput(JSON.stringify(full));

    expect(parsed).not.toBeNull();
    expect(parsed?.impact?.fault).toBe("external");
    expect(parsed?.escalation?.team).toBe("payment-platform");
    expect(parsed?.remediationReview?.verdict).toBe("concerns");
    expect(parsed?.relatedAlerts).toHaveLength(1);
  });

  it("severity / fault / relation / verdict の enum が、パーサ側の許容値と一致する", () => {
    const props = INVESTIGATION_RESPONSE_SCHEMA.properties ?? {};
    expect(props["severity"]?.enum).toEqual(["CRITICAL", "WARNING", "INFO"]);
    expect(props["impact"]?.properties?.["fault"]?.enum).toEqual([
      "own",
      "external",
      "unknown",
    ]);
    expect(props["remediationReview"]?.properties?.["verdict"]?.enum).toEqual([
      "pass",
      "concerns",
      "reject",
    ]);
    // relation はパーサ側が文字列としてしか見ない（丸めない）ため、プロンプトの語彙と揃える。
    expect(props["relatedAlerts"]?.items?.properties?.["relation"]?.enum).toEqual([
      "same_root_cause",
      "downstream",
      "upstream",
      "precursor",
      "similar",
    ]);
  });

  it("根拠なき主張を避けるため、impact / escalation / remediationReview は required に入れない", () => {
    const required = INVESTIGATION_RESPONSE_SCHEMA.required ?? [];
    expect(required).not.toContain("impact");
    expect(required).not.toContain("escalation");
    expect(required).not.toContain("remediationReview");
  });
});
