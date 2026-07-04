import { describe, it, expect } from "vitest";
import { parseLLMOutput, salvageLLMOutput } from "./LLMOutputParser.js";

const validJson = JSON.stringify({
  summary: "DB接続枯渇",
  confidence: 0.87,
  severity: "CRITICAL",
  investigationSteps: ["ログ確認"],
  suggestedActions: ["プール拡張"],
  suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
});

describe("LLMOutputParser", () => {
  describe("parseLLMOutput", () => {
    it("素のJSON文字列をパースする", () => {
      const out = parseLLMOutput(validJson);
      expect(out).not.toBeNull();
      expect(out?.summary).toBe("DB接続枯渇");
      expect(out?.confidence).toBe(0.87);
    });

    it("```json フェンス付きテキストからJSONを抽出する", () => {
      const fenced = "前置き\n```json\n" + validJson + "\n```\n後書き";
      const out = parseLLMOutput(fenced);
      expect(out?.severity).toBe("CRITICAL");
    });

    it("言語指定なしの``` フェンスからも抽出する", () => {
      const fenced = "```\n" + validJson + "\n```";
      expect(parseLLMOutput(fenced)?.summary).toBe("DB接続枯渇");
    });

    it("不正なJSONではnullを返す", () => {
      expect(parseLLMOutput("これはJSONではない")).toBeNull();
      expect(parseLLMOutput("{壊れた")).toBeNull();
    });

    it("必須フィールド欠落ではnullを返す", () => {
      const missing = JSON.stringify({ summary: "x", confidence: 0.5 });
      expect(parseLLMOutput(missing)).toBeNull();
    });

    it("remediable は欠落・非boolはfalse、true指定のみtrueになる", () => {
      expect(parseLLMOutput(validJson)?.remediable).toBe(false);
      const truthy = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "", remediable: true,
      });
      expect(parseLLMOutput(truthy)?.remediable).toBe(true);
      const notBool = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "", remediable: "yes",
      });
      expect(parseLLMOutput(notBool)?.remediable).toBe(false);
    });

    it("steps/actions の非文字列要素は落とす（防御的正規化）", () => {
      const mixed = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: ["ログ確認", { text: "obj" }, 42, "メトリクス相関"],
        suggestedActions: ["対応", null],
        suggestedPatternName: "",
      });
      const out = parseLLMOutput(mixed);
      expect(out?.investigationSteps).toEqual(["ログ確認", "メトリクス相関"]);
      expect(out?.suggestedActions).toEqual(["対応"]);
    });

    it("型不一致(confidenceが文字列)ではnullを返す", () => {
      const badType = JSON.stringify({
        summary: "x",
        confidence: "high",
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
      });
      expect(parseLLMOutput(badType)).toBeNull();
    });

    it("relatedAlerts は欠落で空配列・3フィールド揃った要素のみ残す", () => {
      // 欠落（旧スキーマ互換）
      expect(parseLLMOutput(validJson)?.relatedAlerts).toEqual([]);

      const withRelated = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
        relatedAlerts: [
          { alertId: "a1", relation: "same_root_cause", rationale: "同根" },
          { alertId: "a2", relation: "downstream" }, // rationale 欠落 → 落とす
          "not-an-object", // 型不正 → 落とす
          { alertId: 3, relation: "x", rationale: "y" }, // alertId 非文字列 → 落とす
        ],
      });
      expect(parseLLMOutput(withRelated)?.relatedAlerts).toEqual([
        { alertId: "a1", relation: "same_root_cause", rationale: "同根", citations: [] },
      ]);
    });

    it("relatedAlerts.citations は空白を除いて正規化・欠落/非配列は空配列に丸める", () => {
      const withCitations = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
        relatedAlerts: [
          { alertId: "a1", relation: "same_root_cause", rationale: "同根", citations: ["e12b655", "  ", 7] },
          { alertId: "a2", relation: "downstream", rationale: "波及", citations: "oops" },
        ],
      });
      expect(parseLLMOutput(withCitations)?.relatedAlerts).toEqual([
        { alertId: "a1", relation: "same_root_cause", rationale: "同根", citations: ["e12b655"] },
        { alertId: "a2", relation: "downstream", rationale: "波及", citations: [] },
      ]);
    });

    it("impact は欠落で undefined・揃った構造はそのままパースする", () => {
      // 欠落（旧スキーマ互換）
      expect(parseLLMOutput(validJson)?.impact).toBeUndefined();

      const withImpact = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
        impact: {
          fault: "external",
          scope: "外部決済APIのタイムアウト",
          scale: "決済の約3%が失敗",
          affectedSubjects: ["payment", "checkout"],
          citations: ["log:abc", "incident:i1"],
        },
      });
      expect(parseLLMOutput(withImpact)?.impact).toEqual({
        fault: "external",
        scope: "外部決済APIのタイムアウト",
        scale: "決済の約3%が失敗",
        affectedSubjects: ["payment", "checkout"],
        citations: ["log:abc", "incident:i1"],
      });
    });

    it("impact.fault が own/external/unknown 以外なら unknown に丸める", () => {
      const badFault = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        impact: { fault: "maybe", scope: "s", scale: "n", affectedSubjects: [], citations: ["c1"] },
      });
      expect(parseLLMOutput(badFault)?.impact?.fault).toBe("unknown");
    });

    it("impact の scope/scale が文字列でなければ undefined（構造不正）", () => {
      const noScope = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        impact: { fault: "own", scale: "n", affectedSubjects: [], citations: ["c1"] },
      });
      expect(parseLLMOutput(noScope)?.impact).toBeUndefined();
    });

    it("impact.citations の空白文字列を除く・非配列フィールドは空配列に丸める", () => {
      const messy = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        impact: { fault: "own", scope: "s", scale: "n", affectedSubjects: "oops", citations: ["c1", "  ", "", "c2"] },
      });
      const impact = parseLLMOutput(messy)?.impact;
      expect(impact?.affectedSubjects).toEqual([]);
      expect(impact?.citations).toEqual(["c1", "c2"]);
    });

    it("escalation は欠落で undefined・揃った構造はそのままパースする", () => {
      // 欠落（旧スキーマ互換）
      expect(parseLLMOutput(validJson)?.escalation).toBeUndefined();

      const withEscalation = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        escalation: {
          team: "external-vendor-liaison",
          owner: "外部ベンダー窓口",
          contact: "#vendor-liaison",
          reason: "外部決済APIの障害で自社変更が無いため",
          interimWorkaround: "決済リトライ間隔を延ばす",
          severityRationale: "決済の3%失敗・SLA P1",
          evidenceBundle: ["log:abc", "incident:i1"],
        },
      });
      expect(parseLLMOutput(withEscalation)?.escalation).toEqual({
        team: "external-vendor-liaison",
        owner: "外部ベンダー窓口",
        contact: "#vendor-liaison",
        reason: "外部決済APIの障害で自社変更が無いため",
        interimWorkaround: "決済リトライ間隔を延ばす",
        severityRationale: "決済の3%失敗・SLA P1",
        evidenceBundle: ["log:abc", "incident:i1"],
      });
    });

    it("escalation の文字列欠落は空文字・evidenceBundle の空白/非配列は除く", () => {
      const messy = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        escalation: { team: "platform-sre", evidenceBundle: ["c1", "  ", "", "c2"] },
      });
      const escalation = parseLLMOutput(messy)?.escalation;
      expect(escalation?.team).toBe("platform-sre");
      expect(escalation?.owner).toBe("");
      expect(escalation?.contact).toBe("");
      expect(escalation?.evidenceBundle).toEqual(["c1", "c2"]);

      const badBundle = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        escalation: { team: "platform-sre", evidenceBundle: "oops" },
      });
      expect(parseLLMOutput(badBundle)?.escalation?.evidenceBundle).toEqual([]);
    });

    it("remediationReview は欠落で undefined・揃った構造はそのままパースする", () => {
      // 欠落（旧スキーマ互換）
      expect(parseLLMOutput(validJson)?.remediationReview).toBeUndefined();

      const withReview = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        remediationReview: {
          verdict: "pass",
          concerns: [],
          pullRequestUrl: "https://github.com/o/r/pull/42",
          citations: ["diff:src/payment.ts", "test:payment.timeout.test.ts"],
        },
      });
      expect(parseLLMOutput(withReview)?.remediationReview).toEqual({
        verdict: "pass",
        concerns: [],
        pullRequestUrl: "https://github.com/o/r/pull/42",
        citations: ["diff:src/payment.ts", "test:payment.timeout.test.ts"],
      });
    });

    it("remediationReview.verdict が pass/concerns/reject 以外なら concerns に丸める", () => {
      const badVerdict = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        remediationReview: { verdict: "lgtm", concerns: [], pullRequestUrl: "u", citations: [] },
      });
      expect(parseLLMOutput(badVerdict)?.remediationReview?.verdict).toBe("concerns");

      // verdict 欠落も安全側で concerns
      const noVerdict = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        remediationReview: { pullRequestUrl: "u" },
      });
      expect(parseLLMOutput(noVerdict)?.remediationReview?.verdict).toBe("concerns");
    });

    it("remediationReview の concerns/citations は空白を除き・非配列/文字列欠落を丸める", () => {
      const messy = JSON.stringify({
        summary: "x", confidence: 0.5, severity: "INFO",
        investigationSteps: [], suggestedActions: [], suggestedPatternName: "",
        remediationReview: {
          verdict: "reject",
          concerns: ["根本原因と無関係", "  ", ""],
          pullRequestUrl: 123,
          citations: "oops",
        },
      });
      const review = parseLLMOutput(messy)?.remediationReview;
      expect(review?.verdict).toBe("reject");
      expect(review?.concerns).toEqual(["根本原因と無関係"]);
      expect(review?.pullRequestUrl).toBe("");
      expect(review?.citations).toEqual([]);
    });

    it("relatedAlerts が配列でなければ空配列に丸める", () => {
      const notArray = JSON.stringify({
        summary: "x",
        confidence: 0.5,
        severity: "INFO",
        investigationSteps: [],
        suggestedActions: [],
        suggestedPatternName: "",
        relatedAlerts: "oops",
      });
      expect(parseLLMOutput(notArray)?.relatedAlerts).toEqual([]);
    });
  });

  // fallback 第4原因（最終出力 JSON の mid-string 切断・タスク I1）への防御。
  // 完成済みフィールドだけを best-effort で回収し、部分レポートとして成立させる。
  describe("salvageLLMOutput", () => {
    // アプリコード退行シナリオ実発生系の再現: 正しい JSON が値文字列の途中で切断されている
    const regressionJson = JSON.stringify({
      summary: "コミット e12b655 の SubtotalAmount 変更による退行",
      confidence: 0.95,
      severity: "CRITICAL",
      investigationSteps: ["コミット差分を確認", "例外ログと突合"],
      suggestedActions: ["e12b655 をリバートする"],
      suggestedPatternName: "APP_CODE_REGRESSION",
    });

    it("値文字列の途中で切断された JSON から完成済みフィールドを回収する", () => {
      // suggestedPatternName の値の途中で切る（mid-string 切断）
      const truncated = regressionJson.slice(
        0,
        regressionJson.indexOf('"APP_CODE_REGRESSION"') + 9,
      );
      expect(parseLLMOutput(truncated)).toBeNull(); // 通常パースでは救えないこと

      const out = salvageLLMOutput(truncated);
      expect(out?.summary).toBe("コミット e12b655 の SubtotalAmount 変更による退行");
      expect(out?.confidence).toBe(0.95);
      expect(out?.severity).toBe("CRITICAL");
      expect(out?.investigationSteps).toEqual(["コミット差分を確認", "例外ログと突合"]);
      expect(out?.suggestedActions).toEqual(["e12b655 をリバートする"]);
      // 未完成のフィールドは安全側の既定値
      expect(out?.suggestedPatternName).toBe("");
    });

    it("閉じフェンスの無い ```json 出力（フェンスごと切断）からも回収する", () => {
      const truncated =
        "```json\n" + regressionJson.slice(0, regressionJson.indexOf('"CRITICAL"') + 10);
      const out = salvageLLMOutput(truncated);
      expect(out?.summary).toBe("コミット e12b655 の SubtotalAmount 変更による退行");
      expect(out?.severity).toBe("CRITICAL");
      expect(out?.investigationSteps).toEqual([]); // 未到達フィールドは空
    });

    it("入れ子（relatedAlerts）の途中で切断されても完成済み要素だけ残す", () => {
      const truncated =
        '{"summary":"s","confidence":0.8,"relatedAlerts":[' +
        '{"alertId":"a1","relation":"same_root_cause","rationale":"同根"},{"alertId":"a2","rel';
      const out = salvageLLMOutput(truncated);
      expect(out?.summary).toBe("s");
      expect(out?.relatedAlerts).toEqual([
        { alertId: "a1", relation: "same_root_cause", rationale: "同根", citations: [] },
      ]);
    });

    it("summary が完成していなければ null（fallback の方が正直）", () => {
      expect(salvageLLMOutput('{"summary": "DB接続')).toBeNull();
      expect(salvageLLMOutput('{"summary": ""}')).toBeNull();
    });

    it("JSON が始まらない散文では null", () => {
      expect(salvageLLMOutput("調査の結果、DB接続が枯渇しています。")).toBeNull();
    });

    it("構文は完全だが必須フィールド未達の JSON も summary があれば回収する", () => {
      const partial = JSON.stringify({ summary: "要約のみ", confidence: 0.5 });
      expect(parseLLMOutput(partial)).toBeNull(); // 通常パースは必須スキーマ未達で null
      const out = salvageLLMOutput(partial);
      expect(out?.summary).toBe("要約のみ");
      expect(out?.confidence).toBe(0.5);
      expect(out?.severity).toBe(""); // マッパ側で WARNING に丸まる
    });
  });
});
