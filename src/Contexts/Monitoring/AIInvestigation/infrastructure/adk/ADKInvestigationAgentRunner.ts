import {
  InMemoryRunner,
  isFinalResponse,
  getFunctionCalls,
  getFunctionResponses,
  type Event,
} from "@google/adk";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { InvestigationProgressNotifier } from "../../domain/InvestigationProgressNotifier.js";
import { InvestigationAgentRunner } from "./InvestigationAgentRunner.js";
import type {
  InvestigationFinalizer,
  SubAgentOutput,
} from "./InvestigationFinalizer.js";
import { finalizeInvestigationOutput } from "./finalizeInvestigationOutput.js";
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
import { createCorrelationVerifierAgent } from "./agents/CorrelationVerifierAgent.js";
import { createInvestigationCoordinator } from "./agents/InvestigationCoordinator.js";

const USER_ID = "monitoring-agent";
const APP_NAME = "ec-monitoring-investigation";

/**
 * コーディネーターの思考予算のライブラリ既定（config 未注入時のフォールバック）。timeoutMs と同じく
 * 「アプリ既定は config.ts、ライブラリ安全既定はここ」の二段（両者 16384 で一致）。
 */
const DEFAULT_COORDINATOR_THINKING_BUDGET = 16384;

export type ADKInvestigationAgentRunnerConfig = InvestigationToolDeps &
  EscalationToolDeps &
  RemediationReviewToolDeps & {
  /** Gemini モデル名（env GEMINI_MODEL）。経路は GOOGLE_GENAI_USE_VERTEXAI で Vertex/AI Studio を ADK が自動選択。 */
  readonly model: string;
  /**
   * 相関検証（correlation_verifier・タスク J2）専用のモデル名。批判役は1ショットの keep/reject
   * 判定で深い推論より応答速度が効き、D3 の wall-clock 逼迫（LLM 1呼び出し追加）を緩和するため
   * 軽量モデル（flash）を想定。未指定は model と同一（新しい失敗モードを増やさない安全側）。
   */
  readonly verifierModel?: string;
  /**
   * ロール別の静的モデル割当（D3 対策①・sub-agent 軽量化）。ロール自体が難易度の代理変数なので
   * 実行時のルーター判定は挟まない（+1 LLM 呼び出しの遅延と非決定性を持ち込まない）:
   * - collectorModel : evidence_collector。ツール呼び出しの機械的往復＝推論が薄く、自律ループで
   *   最も回数が嵩むロール。軽量モデル（flash）で wall-clock を最も稼げる。
   * - escalationModel: runbook_escalation。体制マスタ引き＋定型草案で推論が薄い。軽量モデル想定。
   * - triageModel    : impact_triage。citation 必須の算定でガード（citations 空→impact 破棄）に
   *   直結するため、既定は主モデルのまま env で切り替えて計測する（安全側）。
   * いずれも未指定は model と同一（verifierModel と同じ後方互換の流儀）。
   */
  readonly collectorModel?: string;
  readonly escalationModel?: string;
  readonly triageModel?: string;
  /**
   * コーディネーターの思考トークン予算（fallback 第6原因＝思考が maxOutputTokens を食い潰す空応答の防御）。
   * gemini-2.5-pro は思考も出力予算を消費するため上限にキャップして最終JSON用トークンを必ず残す。
   * 有効域 128〜32768・-1 で動的。未指定は安全側の既定（DEFAULT_COORDINATOR_THINKING_BUDGET）。
   */
  readonly coordinatorThinkingBudget?: number;
  /** 自律ループの LLM 呼び出し上限（トークン暴走の安全弁）。 */
  readonly maxLlmCalls: number;
  /** 全体のウォールクロック上限(ms)。超過したらそれまでの最終応答で打ち切る。 */
  readonly timeoutMs?: number;
  /** 調査の所要時間・打ち切り有無を観測するためのロガー（タイムアウト肉薄の監視用）。 */
  readonly logger: Logger;
  /**
   * 実行イベント（ツール呼び出し／サブエージェント委譲）のライブ中継先（タスク E1(b)）。
   * agentTrace ログと同じイベントタップを SSE にも流す。未注入なら中継なし（ログのみ）。
   */
  readonly progressNotifier?: InvestigationProgressNotifier;
  /**
   * エージェントループ終了後に最終 JSON を清書する後段（ADR-26 恒久策の finalizer 方式）。
   * グラフの**外**の直列ステップなのでエージェント数は増えない。未注入ならコーディネーターの
   * 最終テキストをそのまま返す＝従来挙動（縮退リトライだけで防御していた頃と同じ）。
   */
  readonly finalizer?: InvestigationFinalizer;
};

function extractText(event: Event): string {
  const parts = event.content?.parts ?? [];
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");
}

/**
 * AgentTool の function response 本文を文字列化する。ADK は非オブジェクトの戻り値を
 * `{ result }`、失敗を `{ error }` に包む（`agents/functions.js`）ので、その2形だけ素直に開く。
 * それ以外（outputSchema 付きサブエージェントの構造化出力）は JSON のまま清書役へ渡す。
 */
function stringifySubAgentResponse(response: Record<string, unknown> | undefined): string {
  if (!response) return "";
  const result = response["result"];
  if (typeof result === "string") return result;
  const error = response["error"];
  if (typeof error === "string") return `(エラー) ${error}`;
  try {
    return JSON.stringify(response);
  } catch {
    return "";
  }
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
 * finalizer（ADR-26 恒久策）を注入すると、ループ終了後に「サブエージェントの出力群 → 固定スキーマ
 * JSON」の清書を1回だけ直列で挟む。返すのは清書結果だが、清書がパースを通らなければコーディネーター
 * の最終テキストへ戻すので、注入前の挙動が下限として残る。
 *
 * GeminiLLMClient と同じく「疎通主体の薄い infra」なのでユニットテストはコロケーションせず、
 * 分岐ロジック（パース/マッピング/fallback）は ADKAgentInvestigationAdapter、清書の縮退判断は
 * finalizeInvestigationOutput の UT で担保する。
 */
export class ADKInvestigationAgentRunner implements InvestigationAgentRunner {
  private readonly runner: InMemoryRunner;
  private readonly maxLlmCalls: number;
  private readonly timeoutMs: number;
  private readonly logger: Logger;
  private readonly progressNotifier: InvestigationProgressNotifier | undefined;
  private readonly finalizer: InvestigationFinalizer | undefined;
  /**
   * サブエージェント（AgentTool）の名前集合。清書役へ渡す材料を「サブエージェントの出力」に
   * 限るための判別に使う。証拠収集ツール（Cloud Logging 等）の生レスポンスまで混ぜると
   * 清書のコンテキストが調査本体より太るうえ、要約前の一次データが結論を引っ張る。
   */
  private readonly subAgentNames: ReadonlySet<string>;

  constructor(config: ADKInvestigationAgentRunnerConfig) {
    const tools = buildInvestigationTools(config);
    const escalationTools = buildEscalationTools(config);
    const remediationReviewTools = buildRemediationReviewTools(config);
    // coordinator / root_cause_analyst / remediation_planner / remediation_reviewer は
    // 深い推論（証拠統合・因果推論・コード読解）の核なので主モデル固定（ここは削らない）。
    const subAgents = {
      evidenceCollector: createEvidenceCollectorAgent(
        config.collectorModel ?? config.model,
        tools,
      ),
      rootCauseAnalyst: createRootCauseAnalystAgent(config.model),
      remediationPlanner: createRemediationPlannerAgent(config.model),
      impactTriage: createImpactTriageAgent(config.triageModel ?? config.model),
      runbookEscalation: createRunbookEscalationAgent(
        config.escalationModel ?? config.model,
        escalationTools,
      ),
      remediationReviewer: createRemediationReviewerAgent(config.model, remediationReviewTools),
      correlationVerifier: createCorrelationVerifierAgent(
        config.verifierModel ?? config.model,
      ),
    };
    const coordinator = createInvestigationCoordinator({
      model: config.model,
      thinkingBudget:
        config.coordinatorThinkingBudget ?? DEFAULT_COORDINATOR_THINKING_BUDGET,
      ...subAgents,
    });
    // 名前は各 create*Agent が持つ実体から引く（文字列を二重管理するとリネームで静かにずれる）。
    this.subAgentNames = new Set(Object.values(subAgents).map((agent) => agent.name));
    this.runner = new InMemoryRunner({ agent: coordinator, appName: APP_NAME });
    this.maxLlmCalls = config.maxLlmCalls;
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.logger = config.logger;
    this.progressNotifier = config.progressNotifier;
    this.finalizer = config.finalizer;
  }

  async run(
    seedPrompt: string,
    options?: { alertId?: string },
  ): Promise<string> {
    const startedAt = Date.now();
    const deadline = startedAt + this.timeoutMs;
    let finalText = "";
    let eventCount = 0;
    let timedOut = false;
    // どのエージェントがどのツール（AgentTool＝サブエージェント委譲を含む）を呼んだかの実行トレース。
    // これが無いと「サブエージェントが呼ばれなかった」のか「呼ばれたが出力がガードで落ちた」のかを
    // 本番ログで切り分けられない（impact/escalation 不在の一次調査はまずこのトレースを見る）。
    const agentTrace: string[] = [];
    // サブエージェントが返した本文（清書役への材料）。コーディネーターの最終ターンが空でも
    // 調査の実質はここに残っているので、これを拾える限り fallback には落ちない（ADR-26 恒久策）。
    const subAgentOutputs: SubAgentOutput[] = [];

    const stream = this.runner.runEphemeral({
      userId: USER_ID,
      newMessage: { role: "user", parts: [{ text: seedPrompt }] },
      runConfig: { maxLlmCalls: this.maxLlmCalls },
    });

    const alertId = options?.alertId;

    for await (const event of stream) {
      eventCount++;
      for (const call of getFunctionCalls(event)) {
        agentTrace.push(`${event.author ?? "?"}→${call.name ?? "?"}`);
        // agentTrace と同じ実イベントを SSE にライブ中継する（E1(b)・捏造なし）。
        // best-effort: 中継の失敗で調査本体を止めない。
        if (alertId && this.progressNotifier) {
          try {
            this.progressNotifier.notifyInvestigationProgress({
              alertId,
              agent: event.author ?? "unknown",
              tool: call.name ?? "unknown",
              at: new Date().toISOString(),
            });
          } catch {
            // 通知失敗は無視（調査継続）。トレースはログに残る。
          }
        }
      }
      for (const response of getFunctionResponses(event)) {
        const name = response.name ?? "";
        if (!this.subAgentNames.has(name)) continue;
        subAgentOutputs.push({
          agent: name,
          output: stringifySubAgentResponse(response.response),
        });
      }
      if (isFinalResponse(event)) {
        finalText = extractText(event);
      }
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }
    }

    // エージェントループの外で JSON 化だけをやり直す（熟考する仕事と書き出す仕事を同じターンに
    // 置かない）。清書がパースを通らなければコーディネーターの下書きへ黙って戻るので、この段で
    // 現行より悪くなることはない＝縮退リトライ（ADR-26 現行防御）はそのまま後段に残る。
    const finalization = await finalizeInvestigationOutput({
      finalizer: this.finalizer,
      transcript: {
        seedPrompt,
        subAgentOutputs,
        coordinatorFinalText: finalText,
      },
      logger: this.logger,
    });

    // 調査の所要・打ち切り・最終応答長を観測する。timedOut=true（上限到達で打ち切り）や
    // finalTextLen=0（最終応答に未到達）は fallback（暫定表示）の典型。timeoutMs への肉薄を監視する。
    // agentTrace は「呼び出し元→ツール/サブエージェント」の時系列で、impact_triage / runbook_escalation
    // が実際に呼ばれたかをここで確定させる。
    // outputSource は清書役の採用率（finalizer / coordinator）。finalTextLen=0 かつ
    // outputSource=finalizer が「第6原因を恒久策が拾った」実測1件になる。
    await this.logger.info({
      service: "backoffice-backend",
      action: "adk_investigation_run_completed",
      message: `ADK調査実行：elapsedMs=${Date.now() - startedAt}, events=${eventCount}, timedOut=${timedOut}, maxLlmCalls=${this.maxLlmCalls}, finalTextLen=${finalText.length}, outputSource=${finalization.source}, outputLen=${finalization.text.length}, subAgentOutputs=${subAgentOutputs.length}, agentTrace=[${agentTrace.join(" > ") || "(no tool calls)"}]`,
    });

    return finalization.text;
  }
}
