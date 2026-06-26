import { AIInvestigationPort } from "../../domain/AIInvestigationPort.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { LLMTextClient } from "../../domain/LLMTextClient.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "./InvestigationPromptBuilder.js";
import { parseLLMOutput } from "./LLMOutputParser.js";
import { toInvestigationReport, buildFallbackReport } from "./InvestigationReportMapper.js";
import {
  buildEvidenceLinks,
  evidenceLinkConfigFromEnv,
  type EvidenceLinkConfig,
} from "./evidenceLinks.js";

/**
 * AIInvestigationPort の実装（プロバイダ非依存の腐敗防止層）。
 * プロンプト構築 → LLM呼び出し（LLMTextClientへ委譲）→ 出力パース → ドメインマッピングを
 * 組み合わせるだけの薄いオーケストレーション。各処理は専用モジュールに分離済み。
 *
 * Gemini / Vertex AI などプロバイダ固有の関心事は LLMTextClient 実装が持ち、
 * 本クラスはそれを「部品として注入」されて使うだけ（継承ではなくコンポジション）。
 */
export class LLMInvestigationAdapter implements AIInvestigationPort {
  constructor(
    private readonly llm: LLMTextClient,
    // 証拠リンクの URL 基底（owner/repo・GCP project）。既定は環境変数。LLM には URL を作らせず、
    // 収集済み evidence の生フィールドからここで決定的に組み立てる（ハルシネーション URL 排除）。
    private readonly linkConfig: EvidenceLinkConfig = evidenceLinkConfigFromEnv(),
  ) {}

  async investigate(context: InvestigationContext): Promise<InvestigationReport> {
    const prompt = buildUserPrompt(context);

    let raw: string;
    try {
      raw = await this.llm.generate(SYSTEM_INSTRUCTION, prompt);
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
