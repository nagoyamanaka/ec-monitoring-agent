import { describe, it, expect, vi } from "vitest";
import { LLMRemediationPlanner } from "./LLMRemediationPlanner.js";
import { LLMTextClient } from "../../domain/LLMTextClient.js";
import { RemediationInput } from "../../domain/remediation/RemediationInput.js";

const INPUT: RemediationInput = {
  alertId: "550e8400-e29b-41d4-a716-446655440000",
  repo: "owner/repo",
  vulnerabilities: [
    { cveId: "CVE-2024-AAAA", severity: "HIGH", package: "axios", version: "1.6.0", fixedVersion: "1.7.4" },
    { cveId: "CVE-2024-BBBB", severity: "CRITICAL", package: "ws", version: "8.0.0", fixedVersion: "8.17.1" },
  ],
};

const fakeLLM = (generate: LLMTextClient["generate"]): LLMTextClient => ({ generate });

describe("LLMRemediationPlanner", () => {
  it("LLM の JSON 出力（title/recommendations）を採用して plan を組み立てる", async () => {
    const llm = fakeLLM(
      vi.fn().mockResolvedValue(
        JSON.stringify({ title: "Fix deps", recommendations: ["axios を更新", "ws を更新"] }),
      ),
    );
    const plan = await new LLMRemediationPlanner(llm).plan(INPUT);

    expect(plan.title).toBe("Fix deps");
    expect(plan.body).toContain("axios を更新");
    expect(plan.fileChanges).toHaveLength(1);
    expect(plan.fileChanges[0].path).toBe("SECURITY_REMEDIATION.md");
    expect(plan.fileChanges[0].patch).toContain("ws を更新");
  });

  it("```json フェンスや前後テキストがあっても最初の JSON オブジェクトを取り出す", async () => {
    const llm = fakeLLM(
      vi.fn().mockResolvedValue(
        'ここに方針です:\n```json\n{"title": "Fenced", "recommendations": ["r1"]}\n```\nおわり',
      ),
    );
    const plan = await new LLMRemediationPlanner(llm).plan(INPUT);

    expect(plan.title).toBe("Fenced");
    expect(plan.body).toContain("r1");
  });

  it("スキーマ不一致（recommendations 空）なら決定論フォールバックに落ちる", async () => {
    const llm = fakeLLM(
      vi.fn().mockResolvedValue(JSON.stringify({ title: "T", recommendations: [] })),
    );
    const plan = await new LLMRemediationPlanner(llm).plan(INPUT);

    expect(plan.title).toBe("Security remediation: 2 vulnerability fix(es)");
    // fixedVersion ベースの素朴な更新方針
    expect(plan.body).toContain("axios: 1.6.0 → 1.7.4 (CVE-2024-AAAA, HIGH)");
    expect(plan.body).toContain("ws: 8.0.0 → 8.17.1 (CVE-2024-BBBB, CRITICAL)");
  });

  it("LLM 例外時も決定論フォールバックで必ず plan を返す", async () => {
    const llm = fakeLLM(vi.fn().mockRejectedValue(new Error("LLM down")));
    const plan = await new LLMRemediationPlanner(llm).plan(INPUT);

    expect(plan.title).toBe("Security remediation: 2 vulnerability fix(es)");
    expect(plan.fileChanges[0].patch).toContain("axios: 1.6.0 → 1.7.4");
  });

  it("JSON が全く含まれない出力もフォールバックで吸収する", async () => {
    const llm = fakeLLM(vi.fn().mockResolvedValue("plain text, no json"));
    const plan = await new LLMRemediationPlanner(llm).plan(INPUT);

    expect(plan.title).toContain("Security remediation");
  });

  it("packageOverrides に各脆弱パッケージ→fixedVersion を決定論的に組む（実修正の指示）", async () => {
    const llm = fakeLLM(vi.fn().mockResolvedValue("x"));
    const plan = await new LLMRemediationPlanner(llm).plan(INPUT);

    expect(plan.packageOverrides).toEqual({ axios: "1.7.4", ws: "8.17.1" });
  });

  it("fixedVersion が無い脆弱性は packageOverrides から除外する", async () => {
    const llm = fakeLLM(vi.fn().mockResolvedValue("x"));
    const plan = await new LLMRemediationPlanner(llm).plan({
      ...INPUT,
      vulnerabilities: [
        { cveId: "CVE-X", severity: "HIGH", package: "left-pad", version: "1.0.0", fixedVersion: null },
      ],
    });

    expect(plan.packageOverrides).toEqual({});
  });

  it("branch にはアラート短縮IDが含まれる", async () => {
    const llm = fakeLLM(vi.fn().mockResolvedValue("x"));
    const plan = await new LLMRemediationPlanner(llm).plan(INPUT);

    expect(plan.branch).toContain("security/remediation-550e8400-");
  });
});
