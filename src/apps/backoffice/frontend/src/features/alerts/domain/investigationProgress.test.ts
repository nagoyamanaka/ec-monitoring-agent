import { describe, expect, it } from "vitest";
import {
  INVESTIGATION_AGENTS,
  agentLabel,
  progressForRun,
  toInvestigationProgressView,
  toolMeta,
  type InvestigationProgressView,
} from "./investigationProgress";

function makeEvent(
  overrides: Partial<InvestigationProgressView> = {},
): InvestigationProgressView {
  return {
    alertId: "alert-1",
    agent: "evidence_collector",
    tool: "fetch_app_logs",
    at: "2026-07-03T00:00:10.000Z",
    ...overrides,
  };
}

describe("investigationProgress", () => {
  it("ワイヤ契約をそのまま View へ写像する", () => {
    expect(
      toInvestigationProgressView({
        alertId: "a",
        agent: "root_cause_analyst",
        tool: "search_similar_incidents",
        at: "2026-07-03T00:00:00.000Z",
      }),
    ).toEqual({
      alertId: "a",
      agent: "root_cause_analyst",
      tool: "search_similar_incidents",
      at: "2026-07-03T00:00:00.000Z",
    });
  });

  it("台帳は 8 エージェント（backend の ADK 名と整合）", () => {
    expect(INVESTIGATION_AGENTS.map((a) => a.name)).toEqual([
      "investigation_coordinator",
      "evidence_collector",
      "root_cause_analyst",
      "impact_triage",
      "correlation_verifier",
      "remediation_planner",
      "runbook_escalation",
      "remediation_reviewer",
    ]);
  });

  it("agentLabel は登録名を人間語ラベルに、未登録名は生のまま返す", () => {
    expect(agentLabel("evidence_collector")).toBe("EvidenceCollector");
    expect(agentLabel("brand_new_agent")).toBe("brand_new_agent");
  });

  it("toolMeta はツールをラベル化し、エージェント名は委譲として表現する", () => {
    expect(toolMeta("fetch_commit_diff").label).toContain("コミット差分");
    expect(toolMeta("impact_triage").label).toBe("ImpactTriage へ委譲");
    expect(toolMeta("unknown_tool").label).toBe("unknown_tool");
  });

  it("progressForRun は run 開始時刻以降のイベントだけを返す（再調査の古い run を混ぜない）", () => {
    const old = makeEvent({ at: "2026-07-03T00:00:00.000Z" });
    const current = makeEvent({ at: "2026-07-03T00:05:00.000Z" });
    expect(
      progressForRun([old, current], "2026-07-03T00:04:00.000Z"),
    ).toEqual([current]);
  });

  it("progressForRun は不正な開始時刻なら全件を返す（安全側）", () => {
    const events = [makeEvent()];
    expect(progressForRun(events, "not-a-date")).toEqual(events);
  });
});
