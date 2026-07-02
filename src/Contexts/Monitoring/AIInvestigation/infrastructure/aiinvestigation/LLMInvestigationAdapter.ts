import { AIInvestigationPort } from "../../domain/AIInvestigationPort.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { LLMTextClient } from "../../domain/LLMTextClient.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "./InvestigationPromptBuilder.js";
import { parseLLMOutput, rawSnippet } from "./LLMOutputParser.js";
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
    // 調査失敗（LLM 例外／パース不能）を観測するロガー（任意）。未注入なら無言（UT 既定）。
    // これが無いと fallback（confidence=0・暫定表示）に落ちた理由が Cloud Logging に一切出ず、
    // Vertex 側のエラー（認証/quota/location/model 未有効化 等）を追えない。
    private readonly logger?: Logger,
  ) {}

  async investigate(context: InvestigationContext): Promise<InvestigationReport> {
    const prompt = buildUserPrompt(context);
    // fallback（例外／パース不能）でも収集済み証拠のリンクは残せるよう、先に決定的に組んでおく。
    const evidenceLinks = buildEvidenceLinks(context.infraEvidence, this.linkConfig);

    let raw: string;
    try {
      raw = await this.llm.generate(SYSTEM_INSTRUCTION, prompt);
    } catch (error) {
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "ai_investigation_failed",
        message: `AI調査がLLM例外でfallbackに落ちました（confidence=0）: eventName=${context.errorEvent.eventName}, error=${error instanceof Error ? error.message : String(error)}`,
      });
      return buildFallbackReport(evidenceLinks);
    }

    const output = parseLLMOutput(raw);
    if (!output) {
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "ai_investigation_unparseable",
        // rawLen だけでは「なぜパースできなかったか」を本番で追えないため、生出力の先頭スニペットも残す。
        message: `AI調査の応答をパースできずfallbackに落ちました（confidence=0）: eventName=${context.errorEvent.eventName}, rawLen=${raw.length}, rawSnippet=${rawSnippet(raw)}`,
      });
      return buildFallbackReport(evidenceLinks);
    }

    return toInvestigationReport(output, evidenceLinks);
  }
}
