import { AIInvestigationPort } from "../../domain/AIInvestigationPort.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { buildUserPrompt } from "../aiinvestigation/InvestigationPromptBuilder.js";
import { parseLLMOutput, rawSnippet } from "../aiinvestigation/LLMOutputParser.js";
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
    // 調査失敗（runner 例外／パース不能）を観測するロガー（任意）。未注入なら無言（UT 既定）。
    // これが無いと fallback（confidence=0・暫定表示）に落ちた理由が Cloud Logging に一切出ない。
    private readonly logger?: Logger,
  ) {}

  async investigate(context: InvestigationContext): Promise<InvestigationReport> {
    const seedPrompt = buildUserPrompt(context);
    // fallback（例外／パース不能）でも収集済み証拠のリンクは残せるよう、先に決定的に組んでおく。
    const evidenceLinks = buildEvidenceLinks(context.infraEvidence, this.linkConfig);

    let raw: string;
    try {
      // alertId があれば実行イベントのライブ中継（investigation-progress）の相関キーとして渡す。
      raw = await this.runner.run(
        seedPrompt,
        context.alertId ? { alertId: context.alertId } : undefined,
      );
    } catch (error) {
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "ai_investigation_failed",
        message: `AI調査(ADK)がrunner例外でfallbackに落ちました（confidence=0）: eventName=${context.errorEvent.eventName}, error=${error instanceof Error ? error.message : String(error)}`,
      });
      return buildFallbackReport(evidenceLinks);
    }

    const output = parseLLMOutput(raw);
    if (!output) {
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "ai_investigation_unparseable",
        // rawLen だけでは「なぜパースできなかったか」を本番で追えないため、生出力の先頭を
        // 改行を潰した1行スニペットで残す（JSON でなく散文が返ったか等を判別する）。
        message: `AI調査(ADK)の最終出力をパースできずfallbackに落ちました（confidence=0）: eventName=${context.errorEvent.eventName}, rawLen=${raw.length}, rawSnippet=${rawSnippet(raw)}`,
      });
      return buildFallbackReport(evidenceLinks);
    }

    return toInvestigationReport(output, evidenceLinks);
  }
}
