import { AIInvestigationPort } from "../../domain/AIInvestigationPort.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { buildUserPrompt } from "../aiinvestigation/InvestigationPromptBuilder.js";
import { parseLLMOutput } from "../aiinvestigation/LLMOutputParser.js";
import {
  toInvestigationReport,
  buildFallbackReport,
} from "../aiinvestigation/InvestigationReportMapper.js";
import {
  buildEvidenceLinks,
  evidenceLinkConfigFromEnv,
  type EvidenceLinkConfig,
} from "../aiinvestigation/evidenceLinks.js";
import { InvestigationAgentRunner } from "./InvestigationAgentRunner.js";

/**
 * AIInvestigationPort の ADK マルチエージェント実装（タスク18）。
 *
 * 単一Gemini版（LLMInvestigationAdapter）と同じ薄いオーケストレーション構造を取り、
 * 違いは「1ショットの text 生成」を「自律的に証拠を追加収集するエージェント・グラフ」に
 * 差し替えた点だけ。プロンプト構築・出力パース・ドメインマッピング・fallback は単一Gemini版と
 * 完全に共通（DRY）。これにより BackofficeApp での AIInvestigationPort 差し替え1点で載る。
 *
 * InvestigationAgentRunner を注入で受けることで、ADK 依存を持たず fake 注入で UT 可能
 * （正常系→マッピング / 例外→fallback / パース不能→fallback の全分岐）。
 */
export class ADKAgentInvestigationAdapter implements AIInvestigationPort {
  constructor(
    private readonly runner: InvestigationAgentRunner,
    // 証拠リンクの基底（owner/repo・GCP project）。LLM に URL を作らせず evidence から決定的に組む。
    private readonly linkConfig: EvidenceLinkConfig = evidenceLinkConfigFromEnv(),
  ) {}

  async investigate(context: InvestigationContext): Promise<InvestigationReport> {
    const seedPrompt = buildUserPrompt(context);

    let raw: string;
    try {
      raw = await this.runner.run(seedPrompt);
    } catch {
      return buildFallbackReport();
    }

    const output = parseLLMOutput(raw);
    if (!output) {
      return buildFallbackReport();
    }

    const evidenceLinks = buildEvidenceLinks(context.infraEvidence, this.linkConfig);
    return toInvestigationReport(output, evidenceLinks);
  }
}
