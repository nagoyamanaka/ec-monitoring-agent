import { describe, expect, it } from "vitest";
import { humanizeAgentNames, mentionedAgents } from "./investigationStepText";

describe("humanizeAgentNames", () => {
  it("生エージェント名を台帳の label へ写像する", () => {
    expect(humanizeAgentNames("root_cause_analystで根本原因を分析")).toBe(
      "RootCauseAnalystで根本原因を分析",
    );
  });

  it("複数の出現をすべて置換する", () => {
    expect(
      humanizeAgentNames(
        "impact_triageで影響を評価し、remediation_plannerで修正方針を起案",
      ),
    ).toBe("ImpactTriageで影響を評価し、RemediationPlannerで修正方針を起案");
  });

  it("エージェント名を含まない文は原文のまま", () => {
    expect(humanizeAgentNames("Cloud Logging のエラーログを確認")).toBe(
      "Cloud Logging のエラーログを確認",
    );
  });
});

describe("mentionedAgents", () => {
  it("ステップ文に登場したエージェントを台帳順で返す", () => {
    const agents = mentionedAgents([
      "remediation_plannerで修正方針を起案",
      "root_cause_analystで根本原因を分析",
    ]);
    // 出現順でなく台帳順（調査の概念的な流れ）
    expect(agents.map((a) => a.label)).toEqual([
      "RootCauseAnalyst",
      "RemediationPlanner",
    ]);
  });

  it("エージェント言及の無いステップでは空（ハイライト無しの劣化側）", () => {
    expect(mentionedAgents(["ログを確認", "メトリクス相関"])).toEqual([]);
  });
});
