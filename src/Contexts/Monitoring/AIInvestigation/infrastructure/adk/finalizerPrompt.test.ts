import { describe, it, expect } from "vitest";
import { buildFinalizerPrompt, FINALIZER_INSTRUCTION } from "./finalizerPrompt.js";
import { SYSTEM_INSTRUCTION } from "../aiinvestigation/InvestigationPromptBuilder.js";

describe("buildFinalizerPrompt", () => {
  it("サブエージェント出力を時系列で載せ、下書きと入力も渡す", () => {
    const prompt = buildFinalizerPrompt({
      seedPrompt: '{"citableIds":["checkout.db.pool_exhausted"]}',
      subAgentOutputs: [
        { agent: "root_cause_analyst", output: "接続プール枯渇" },
        { agent: "runbook_escalation", output: "team: payment-platform" },
      ],
      coordinatorFinalText: '{"summary":"下書き"}',
    });

    expect(prompt).toContain("checkout.db.pool_exhausted");
    expect(prompt).toContain("### 1. root_cause_analyst");
    expect(prompt).toContain("### 2. runbook_escalation");
    expect(prompt).toContain("team: payment-platform");
    expect(prompt).toContain('{"summary":"下書き"}');
    expect(prompt.indexOf("root_cause_analyst")).toBeLessThan(
      prompt.indexOf("runbook_escalation"),
    );
  });

  it("下書きが空でも「サブエージェント出力から組み立てよ」と明示する（空応答が本命ケース）", () => {
    const prompt = buildFinalizerPrompt({
      seedPrompt: "{}",
      subAgentOutputs: [{ agent: "root_cause_analyst", output: "接続プール枯渇" }],
      coordinatorFinalText: "   ",
    });

    expect(prompt).toContain("組み立てて");
    expect(prompt).toContain("接続プール枯渇");
  });

  it("サブエージェント出力が1件も無い場合もプロンプトとして成立する", () => {
    const prompt = buildFinalizerPrompt({
      seedPrompt: "{}",
      subAgentOutputs: [],
      coordinatorFinalText: "",
    });

    expect(prompt).toContain("(サブエージェントの出力なし)");
  });

  it("長大なサブエージェント出力は先頭を残して切り詰める（清書のコンテキストが調査本体より太らない）", () => {
    const huge = "あ".repeat(20_000);
    const prompt = buildFinalizerPrompt({
      seedPrompt: "{}",
      subAgentOutputs: [{ agent: "evidence_collector", output: huge }],
      coordinatorFinalText: "",
    });

    expect(prompt).toContain("（以下省略）");
    expect(prompt.length).toBeLessThan(huge.length);
  });

  it("出力スキーマ・引用規約は調査本体と同一ソース（SYSTEM_INSTRUCTION）を再利用する", () => {
    expect(FINALIZER_INSTRUCTION.startsWith(SYSTEM_INSTRUCTION)).toBe(true);
    expect(FINALIZER_INSTRUCTION).toContain("清書役");
  });
});
