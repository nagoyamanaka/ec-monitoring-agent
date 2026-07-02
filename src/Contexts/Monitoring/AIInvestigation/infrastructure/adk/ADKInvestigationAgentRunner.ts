import {
  InMemoryRunner,
  isFinalResponse,
  getFunctionCalls,
  type Event,
} from "@google/adk";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { InvestigationAgentRunner } from "./InvestigationAgentRunner.js";
import {
  buildInvestigationTools,
  type InvestigationToolDeps,
} from "./tools/investigationTools.js";
import {
  buildEscalationTools,
  type EscalationToolDeps,
} from "./tools/escalationTools.js";
import {
  buildRemediationReviewTools,
  type RemediationReviewToolDeps,
} from "./tools/remediationReviewTools.js";
import { createEvidenceCollectorAgent } from "./agents/EvidenceCollectorAgent.js";
import { createRootCauseAnalystAgent } from "./agents/RootCauseAnalystAgent.js";
import { createRemediationPlannerAgent } from "./agents/RemediationPlannerAgent.js";
import { createImpactTriageAgent } from "./agents/ImpactTriageAgent.js";
import { createRunbookEscalationAgent } from "./agents/RunbookEscalationAgent.js";
import { createRemediationReviewerAgent } from "./agents/RemediationReviewerAgent.js";
import { createInvestigationCoordinator } from "./agents/InvestigationCoordinator.js";

const USER_ID = "monitoring-agent";
const APP_NAME = "ec-monitoring-investigation";

export type ADKInvestigationAgentRunnerConfig = InvestigationToolDeps &
  EscalationToolDeps &
  RemediationReviewToolDeps & {
  /** Gemini モデル名（env GEMINI_MODEL）。経路は GOOGLE_GENAI_USE_VERTEXAI で Vertex/AI Studio を ADK が自動選択。 */
  readonly model: string;
  /** 自律ループの LLM 呼び出し上限（トークン暴走の安全弁）。 */
  readonly maxLlmCalls: number;
  /** 全体のウォールクロック上限(ms)。超過したらそれまでの最終応答で打ち切る。 */
  readonly timeoutMs?: number;
  /** 調査の所要時間・打ち切り有無を観測するためのロガー（タイムアウト肉薄の監視用）。 */
  readonly logger: Logger;
};

function extractText(event: Event): string {
  const parts = event.content?.parts ?? [];
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
}

/**
 * ADK マルチエージェント・グラフを構築して実行する InvestigationAgentRunner 実装。
 *
 * Coordinator(hub) + EvidenceCollector / RootCauseAnalyst / RemediationPlanner(spoke) を
 * in-process で組み、seed プロンプトを投げて最終応答テキスト（固定スキーマ JSON）を返す。
 *
 * モデル到達経路（Vertex AI / AI Studio）は @google/genai と同じ env で ADK が自動選択するため、
 * 本クラスは経路を意識しない（Part1 で本番は GOOGLE_GENAI_USE_VERTEXAI=true＝無料クレジット）。
 *
 * GeminiLLMClient と同じく「疎通主体の薄い infra」なのでユニットテストはコロケーションせず、
 * 分岐ロジック（パース/マッピング/fallback）は ADKAgentInvestigationAdapter 側の UT で担保する。
 */
export class ADKInvestigationAgentRunner implements InvestigationAgentRunner {
  private readonly runner: InMemoryRunner;
  private readonly maxLlmCalls: number;
  private readonly timeoutMs: number;
  private readonly logger: Logger;

  constructor(config: ADKInvestigationAgentRunnerConfig) {
    const tools = buildInvestigationTools(config);
    const escalationTools = buildEscalationTools(config);
    const remediationReviewTools = buildRemediationReviewTools(config);
    const coordinator = createInvestigationCoordinator({
      model: config.model,
      evidenceCollector: createEvidenceCollectorAgent(config.model, tools),
      rootCauseAnalyst: createRootCauseAnalystAgent(config.model),
      remediationPlanner: createRemediationPlannerAgent(config.model),
      impactTriage: createImpactTriageAgent(config.model),
      runbookEscalation: createRunbookEscalationAgent(config.model, escalationTools),
      remediationReviewer: createRemediationReviewerAgent(config.model, remediationReviewTools),
    });
    this.runner = new InMemoryRunner({ agent: coordinator, appName: APP_NAME });
    this.maxLlmCalls = config.maxLlmCalls;
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.logger = config.logger;
  }

  async run(seedPrompt: string): Promise<string> {
    const startedAt = Date.now();
    const deadline = startedAt + this.timeoutMs;
    let finalText = "";
    let eventCount = 0;
    let timedOut = false;
    // どのエージェントがどのツール（AgentTool＝サブエージェント委譲を含む）を呼んだかの実行トレース。
    // これが無いと「サブエージェントが呼ばれなかった」のか「呼ばれたが出力がガードで落ちた」のかを
    // 本番ログで切り分けられない（impact/escalation 不在の一次調査はまずこのトレースを見る）。
    const agentTrace: string[] = [];

    const stream = this.runner.runEphemeral({
      userId: USER_ID,
      newMessage: { role: "user", parts: [{ text: seedPrompt }] },
      runConfig: { maxLlmCalls: this.maxLlmCalls },
    });

    for await (const event of stream) {
      eventCount++;
      for (const call of getFunctionCalls(event)) {
        agentTrace.push(`${event.author ?? "?"}→${call.name ?? "?"}`);
      }
      if (isFinalResponse(event)) {
        finalText = extractText(event);
      }
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }
    }

    // 調査の所要・打ち切り・最終応答長を観測する。timedOut=true（上限到達で打ち切り）や
    // finalTextLen=0（最終応答に未到達）は fallback（暫定表示）の典型。timeoutMs への肉薄を監視する。
    // agentTrace は「呼び出し元→ツール/サブエージェント」の時系列で、impact_triage / runbook_escalation
    // が実際に呼ばれたかをここで確定させる。
    await this.logger.info({
      service: "backoffice-backend",
      action: "adk_investigation_run_completed",
      message: `ADK調査実行：elapsedMs=${Date.now() - startedAt}, events=${eventCount}, timedOut=${timedOut}, maxLlmCalls=${this.maxLlmCalls}, finalTextLen=${finalText.length}, agentTrace=[${agentTrace.join(" > ") || "(no tool calls)"}]`,
    });

    return finalText;
  }
}
