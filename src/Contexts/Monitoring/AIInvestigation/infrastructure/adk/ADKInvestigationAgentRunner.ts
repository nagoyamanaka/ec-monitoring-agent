import { InMemoryRunner, isFinalResponse, type Event } from "@google/adk";
import { InvestigationAgentRunner } from "./InvestigationAgentRunner.js";
import {
  buildInvestigationTools,
  type InvestigationToolDeps,
} from "./tools/investigationTools.js";
import { createEvidenceCollectorAgent } from "./agents/EvidenceCollectorAgent.js";
import { createRootCauseAnalystAgent } from "./agents/RootCauseAnalystAgent.js";
import { createRemediationPlannerAgent } from "./agents/RemediationPlannerAgent.js";
import { createImpactTriageAgent } from "./agents/ImpactTriageAgent.js";
import { createInvestigationCoordinator } from "./agents/InvestigationCoordinator.js";

const USER_ID = "monitoring-agent";
const APP_NAME = "ec-monitoring-investigation";

export type ADKInvestigationAgentRunnerConfig = InvestigationToolDeps & {
  /** Gemini モデル名（env GEMINI_MODEL）。経路は GOOGLE_GENAI_USE_VERTEXAI で Vertex/AI Studio を ADK が自動選択。 */
  readonly model: string;
  /** 自律ループの LLM 呼び出し上限（トークン暴走の安全弁）。 */
  readonly maxLlmCalls: number;
  /** 全体のウォールクロック上限(ms)。超過したらそれまでの最終応答で打ち切る。 */
  readonly timeoutMs?: number;
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

  constructor(config: ADKInvestigationAgentRunnerConfig) {
    const tools = buildInvestigationTools(config);
    const coordinator = createInvestigationCoordinator({
      model: config.model,
      evidenceCollector: createEvidenceCollectorAgent(config.model, tools),
      rootCauseAnalyst: createRootCauseAnalystAgent(config.model),
      remediationPlanner: createRemediationPlannerAgent(config.model),
      impactTriage: createImpactTriageAgent(config.model),
    });
    this.runner = new InMemoryRunner({ agent: coordinator, appName: APP_NAME });
    this.maxLlmCalls = config.maxLlmCalls;
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async run(seedPrompt: string): Promise<string> {
    const deadline = Date.now() + this.timeoutMs;
    let finalText = "";

    const stream = this.runner.runEphemeral({
      userId: USER_ID,
      newMessage: { role: "user", parts: [{ text: seedPrompt }] },
      runConfig: { maxLlmCalls: this.maxLlmCalls },
    });

    for await (const event of stream) {
      if (isFinalResponse(event)) {
        finalText = extractText(event);
      }
      if (Date.now() > deadline) break;
    }

    return finalText;
  }
}
