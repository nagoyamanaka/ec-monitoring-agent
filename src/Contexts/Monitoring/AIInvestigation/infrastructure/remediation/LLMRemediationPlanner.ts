import { LLMTextClient } from "../../domain/LLMTextClient.js";
import {
  RemediationInput,
  RemediationVulnerability,
} from "../../domain/remediation/RemediationInput.js";
import { RemediationPlan } from "../../domain/remediation/RemediationPlan.js";
import { RemediationPlanner } from "../../domain/remediation/RemediationPlanner.js";

const SYSTEM_INSTRUCTION = [
  "あなたはセキュリティ脆弱性の修正PR草案を作成するアシスタントです。",
  "与えられた脆弱性一覧に対し、依存パッケージの更新を中心とした修正方針を簡潔にまとめます。",
  '出力は必ず JSON のみ。形式: {"title": string, "recommendations": string[]}。',
  "recommendations は1要素=1脆弱性の対処方針（例: 'axios を 1.6.0 → 1.7.4 に更新 (CVE-XXXX)'）。",
].join("\n");

/**
 * RemediationPlanner の既定実装。AI（LLMTextClient）に修正方針を起草させ、
 * 全 CVE を1つの草案 PR（SECURITY_REMEDIATION.md 追加）にまとめる。
 *
 * LLM の出力は「方針テキスト（title / recommendations）」に限定し、ファイルパスや
 * パッチ全文は LLM に生成させない（ハルシネーションでリポジトリを壊さないための足場）。
 * LLM 不通・スキーマ不一致時は決定論フォールバック（fixedVersion ベースの一覧）に落ちる。
 * ＝ StubLLMClient（E2E）でも安全に同じ経路を通せる。
 */
export class LLMRemediationPlanner implements RemediationPlanner {
  constructor(private readonly llm: LLMTextClient) {}

  async plan(input: RemediationInput): Promise<RemediationPlan> {
    const drafted = await this.draftRecommendations(input);
    return this.assemblePlan(input, drafted.title, drafted.recommendations);
  }

  private async draftRecommendations(
    input: RemediationInput,
  ): Promise<{ title: string; recommendations: string[] }> {
    try {
      const raw = await this.llm.generate(SYSTEM_INSTRUCTION, this.buildPrompt(input));
      const parsed = JSON.parse(this.extractJsonObject(raw)) as {
        title?: unknown;
        recommendations?: unknown;
      };
      if (
        typeof parsed.title === "string" &&
        parsed.title.length > 0 &&
        Array.isArray(parsed.recommendations) &&
        parsed.recommendations.length > 0
      ) {
        return {
          title: parsed.title,
          recommendations: parsed.recommendations.map((r) => String(r)),
        };
      }
    } catch {
      // LLM 失敗・JSON 不正・スキーマ不一致は決定論フォールバックへ
    }
    return this.deterministic(input);
  }

  // fixedVersion ベースの素朴な更新方針。LLM 非依存で必ず成立する安全側の草案。
  private deterministic(input: RemediationInput): {
    title: string;
    recommendations: string[];
  } {
    const recommendations = input.vulnerabilities.map((v) => this.describeFix(v));
    return {
      title: `Security remediation: ${input.vulnerabilities.length} vulnerability fix(es)`,
      recommendations,
    };
  }

  private describeFix(v: RemediationVulnerability): string {
    const pkg = v.package ?? "(unknown package)";
    const from = v.version ?? "?";
    const to = v.fixedVersion ?? "(no fixed version available)";
    return `${pkg}: ${from} → ${to} (${v.cveId}, ${v.severity})`;
  }

  private assemblePlan(
    input: RemediationInput,
    title: string,
    recommendations: string[],
  ): RemediationPlan {
    const shortId = input.alertId.slice(0, 8);
    const branch = `security/remediation-${shortId}-${Date.now()}`;

    const fileContent = [
      "# Security Remediation (AI draft)",
      "",
      `Alert: \`${input.alertId}\``,
      input.repo ? `Repository: \`${input.repo}\`` : null,
      `Vulnerabilities: ${input.vulnerabilities.length} (HIGH/CRITICAL)`,
      "",
      "## Proposed fixes",
      "",
      ...recommendations.map((r) => `- ${r}`),
      "",
      "> このPRは自動起票された草案です。マージ前に必ず人間がレビューしてください。",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const body = [
      "AI が起票したセキュリティ修正の草案です（自動マージはしません）。",
      "",
      `- 対象アラート: \`${input.alertId}\``,
      `- 脆弱性件数: ${input.vulnerabilities.length}`,
      "",
      "### 修正方針",
      ...recommendations.map((r) => `- ${r}`),
    ].join("\n");

    return {
      title,
      branch,
      body,
      fileChanges: [{ path: "SECURITY_REMEDIATION.md", patch: fileContent }],
      // 実修正: 各脆弱パッケージを fixedVersion へ固定する overrides を決定論的に組む
      // （fixedVersion は Trivy 由来の実データ＝ハルシネーションなし）。gateway が
      // base の package.json.pnpm.overrides にマージし、方針 md と併せて本物の diff にする。
      packageOverrides: this.buildPackageOverrides(input),
    };
  }

  // 対象パッケージと fixedVersion が揃うものだけを overrides 化する（欠損は方針 md 側で言及）。
  private buildPackageOverrides(
    input: RemediationInput,
  ): Record<string, string> {
    const overrides: Record<string, string> = {};
    for (const v of input.vulnerabilities) {
      if (v.package && v.fixedVersion) overrides[v.package] = v.fixedVersion;
    }
    return overrides;
  }

  private buildPrompt(input: RemediationInput): string {
    const lines = input.vulnerabilities.map((v) => this.describeFix(v));
    return [
      input.repo ? `Repository: ${input.repo}` : "Repository: (unknown)",
      `脆弱性（${input.vulnerabilities.length}件）:`,
      ...lines.map((l) => `- ${l}`),
      "",
      "上記すべてを1つの修正PRで対処する方針を JSON で返してください。",
    ].join("\n");
  }

  // ```json ... ``` フェンスや前後テキストを許容し最初の JSON オブジェクトを取り出す。
  private extractJsonObject(raw: string): string {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("no JSON object found in LLM output");
    }
    return raw.slice(start, end + 1);
  }
}
