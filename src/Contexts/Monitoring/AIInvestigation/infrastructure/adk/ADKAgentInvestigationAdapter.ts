import { AIInvestigationPort } from "../../domain/AIInvestigationPort.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { buildUserPrompt } from "../aiinvestigation/InvestigationPromptBuilder.js";
import { parseLLMOutput, salvageLLMOutput, rawSnippet } from "../aiinvestigation/LLMOutputParser.js";
import {
  toInvestigationReport,
  buildFallbackReport,
} from "../aiinvestigation/InvestigationReportMapper.js";
import { collectCitableEvidenceIds } from "../../domain/CitedEvidence.js";
import { buildCitationCatalog } from "../../domain/CitationResolution.js";
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
 * （正常系→マッピング / 例外→fallback / パース不能→fallback / 縮退リトライの全分岐）。
 */
export class ADKAgentInvestigationAdapter implements AIInvestigationPort {
  constructor(
    private readonly runner: InvestigationAgentRunner,
    // 証拠リンクの基底（owner/repo・GCP project）。LLM に URL を作らせず evidence から決定的に組む。
    private readonly linkConfig: EvidenceLinkConfig = evidenceLinkConfigFromEnv(),
    // 調査失敗（runner 例外／パース不能）を観測するロガー（任意）。未注入なら無言（UT 既定）。
    // これが無いと fallback（confidence=0・暫定表示）に落ちた理由が Cloud Logging に一切出ない。
    private readonly logger?: Logger,
    // fallback 第6原因（思考トークンが出力予算を食い潰し空応答）への縮退リトライ用ランナー。
    // 同一グラフを思考予算だけ落として組んだもの（BackofficeApp が注入）を想定する。
    // 盲目の再実行でなく「思考↓＝最終JSON用トークン保証↑」で失敗機序そのものに切り込む。
    // 未注入なら従来どおり1回で fallback（UT・単一Gemini との互換を保つ）。
    private readonly retryRunner?: InvestigationAgentRunner,
  ) {}

  async investigate(context: InvestigationContext): Promise<InvestigationReport> {
    const seedPrompt = buildUserPrompt(context);
    // fallback（例外／パース不能）でも収集済み証拠のリンクは残せるよう、先に決定的に組んでおく。
    const evidenceLinks = buildEvidenceLinks(context.infraEvidence, this.linkConfig);
    // 相関ガード（relatedAlerts の citation 実在照合）の語彙。収集済み証拠から決定的に導出する。
    const citableEvidenceIds = collectCitableEvidenceIds(context.infraEvidence);
    // 引用の表示用照合カタログ（impact/escalation の citationRefs）。同じく決定的に導出する。
    const citationCatalog = buildCitationCatalog(context);

    const first = await this.attempt(this.runner, 1, context, seedPrompt, {
      evidenceLinks,
      citableEvidenceIds,
      citationCatalog,
    });
    if (first) return first;

    if (this.retryRunner) {
      // 空応答/パース不能/例外の3態とも一過性（サンプリング・思考予算超過・瞬断）でありうるため
      // 1回だけ縮退再実行する。上限1回＝prefetch(1) の HOL ブロッキングを有界に保つ。
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "ai_investigation_retrying",
        message: `AI調査(ADK)の1回目が失敗したため思考予算を落として再実行します: eventName=${context.errorEvent.eventName}`,
      });
      const second = await this.attempt(this.retryRunner, 2, context, seedPrompt, {
        evidenceLinks,
        citableEvidenceIds,
        citationCatalog,
      });
      if (second) return second;
    }

    return buildFallbackReport(evidenceLinks);
  }

  /** 1回ぶんの実行→パース→マッピング。失敗（例外／パース不能かつ回収不能）は null（呼び元が縮退判断）。 */
  private async attempt(
    runner: InvestigationAgentRunner,
    attemptNo: number,
    context: InvestigationContext,
    seedPrompt: string,
    mapping: {
      evidenceLinks: ReturnType<typeof buildEvidenceLinks>;
      citableEvidenceIds: ReturnType<typeof collectCitableEvidenceIds>;
      citationCatalog: ReturnType<typeof buildCitationCatalog>;
    },
  ): Promise<InvestigationReport | null> {
    let raw: string;
    try {
      // alertId があれば実行イベントのライブ中継（investigation-progress）の相関キーとして渡す。
      raw = await runner.run(
        seedPrompt,
        context.alertId ? { alertId: context.alertId } : undefined,
      );
    } catch (error) {
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "ai_investigation_failed",
        message: `AI調査(ADK)がrunner例外で失敗しました（attempt=${attemptNo}）: eventName=${context.errorEvent.eventName}, error=${error instanceof Error ? error.message : String(error)}`,
      });
      return null;
    }

    const output = parseLLMOutput(raw);
    if (!output) {
      // fallback 第4原因（最終出力 JSON の mid-string 切断）への防御: 完成済みフィールドだけでも
      // best-effort で回収し、fallback でなく部分レポートとして返す（分析が正解なのに
      // 「自動調査に失敗しました」を出すデモ即死パターンを潰す・タスク I1）。
      const salvaged = salvageLLMOutput(raw);
      if (salvaged) {
        await this.logger?.warn({
          service: "backoffice-backend",
          action: "ai_investigation_salvaged",
          message: `AI調査(ADK)の最終出力が途中切断されていたため部分レポートを回収しました（attempt=${attemptNo}）: eventName=${context.errorEvent.eventName}, rawLen=${raw.length}, rawSnippet=${rawSnippet(raw)}`,
        });
        return toInvestigationReport(
          salvaged,
          mapping.evidenceLinks,
          mapping.citableEvidenceIds,
          mapping.citationCatalog,
        );
      }
      await this.logger?.warn({
        service: "backoffice-backend",
        action: "ai_investigation_unparseable",
        // rawLen だけでは「なぜパースできなかったか」を本番で追えないため、生出力の先頭を
        // 改行を潰した1行スニペットで残す（JSON でなく散文が返ったか等を判別する）。
        message: `AI調査(ADK)の最終出力をパースできませんでした（attempt=${attemptNo}）: eventName=${context.errorEvent.eventName}, rawLen=${raw.length}, rawSnippet=${rawSnippet(raw)}`,
      });
      return null;
    }

    return toInvestigationReport(
      output,
      mapping.evidenceLinks,
      mapping.citableEvidenceIds,
      mapping.citationCatalog,
    );
  }
}
