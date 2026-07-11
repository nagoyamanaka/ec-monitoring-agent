import type { InvestigationProgressPrimitives } from "@monitoring/AIInvestigation/domain/contracts/InvestigationProgressContract";

/**
 * AI 調査の進行イベント（SSE "investigation-progress"）の表示用型と純関数（タスク E1）。
 * domain は型＋純関数のみ。ワイヤ形式は backend と共有する contracts を単一ソースとして import する。
 * イベントは backend の ADK runner が観測した**実イベントのみ**（演出の捏造はしない）。
 */

export type InvestigationProgressView = {
  readonly alertId: string;
  /** イベントを発したエージェント名（ADK の author。例: evidence_collector）。 */
  readonly agent: string;
  /** 呼んだツール名。サブエージェント委譲は委譲先エージェント名が入る（例: impact_triage）。 */
  readonly tool: string;
  /** backend の観測時刻（ISO 8601）。 */
  readonly at: string;
};

export function toInvestigationProgressView(
  dto: InvestigationProgressPrimitives,
): InvestigationProgressView {
  return { alertId: dto.alertId, agent: dto.agent, tool: dto.tool, at: dto.at };
}

/** エージェント台帳の1行（役割の1行説明つき）。backend の ADK エージェント名と整合。 */
export type AgentInfo = {
  readonly name: string;
  readonly label: string;
  readonly role: string;
};

/**
 * hub-and-spoke 8 エージェントの台帳（表示順＝調査の概念的な流れ）。
 * name は ADK の agent 名（進行イベントの author / AgentTool 委譲名）と一致させる。
 */
export const INVESTIGATION_AGENTS: readonly AgentInfo[] = [
  {
    name: "investigation_coordinator",
    label: "Coordinator",
    role: "調査全体を指揮し、専門エージェントへ委譲",
  },
  {
    name: "evidence_collector",
    label: "EvidenceCollector",
    role: "ログ・Terraform・コミット・類似事例DB から証拠を収集",
  },
  {
    name: "root_cause_analyst",
    label: "RootCauseAnalyst",
    role: "証拠から原因仮説を構築",
  },
  {
    name: "impact_triage",
    label: "ImpactTriage",
    role: "自責/他責・影響範囲・障害規模を評価",
  },
  {
    name: "correlation_verifier",
    label: "CorrelationVerifier",
    role: "相関主張の共有証拠と因果の向きを検証（批判役）",
  },
  {
    name: "remediation_planner",
    label: "RemediationPlanner",
    role: "修正方針（コードで直せるか）を起案",
  },
  {
    name: "runbook_escalation",
    label: "RunbookEscalation",
    role: "他責/運用案件のエスカレーション草案を作成",
  },
  {
    name: "remediation_reviewer",
    label: "RemediationReviewer",
    role: "修正PRの差分と CI を自動レビュー",
  },
];

/**
 * ツールアイコンの意味名（L1）。domain はグリフや SVG を持たず名前だけを語り、
 * 描画（SVG コンポーネントへの対応）は presentation 側の TOOL_ICONS が担う。
 */
export type ToolIconName =
  | "logs"
  | "terraform"
  | "commits"
  | "similar"
  | "runbook"
  | "delegate"
  | "generic";

/** ツール（狙い撃ち証拠取得）の人間語ラベル＋アイコン。EvidencePanel の SOURCE_META と整合。 */
const TOOL_META: Record<string, { label: string; icon: ToolIconName }> = {
  fetch_app_logs: { label: "Cloud Logging からログ取得", icon: "logs" },
  fetch_terraform_diff: { label: "Terraform 差分を確認", icon: "terraform" },
  fetch_recent_commits: { label: "GitHub の直近コミットを確認", icon: "commits" },
  fetch_commit_diff: { label: "GitHub のコミット差分を精査", icon: "commits" },
  search_similar_incidents: { label: "類似事例DBを検索", icon: "similar" },
  find_escalation_owners: { label: "体制マスタから宛先を検索", icon: "runbook" },
  get_pull_request_diff: { label: "修正PRの差分を取得", icon: "commits" },
  get_pull_request_checks: { label: "修正PRの CI 結果を確認", icon: "commits" },
};

const AGENT_BY_NAME = new Map(INVESTIGATION_AGENTS.map((a) => [a.name, a]));

/** agent 名 → 表示ラベル。未登録名（将来の追加）は生の名前をそのまま出す。 */
export function agentLabel(name: string): string {
  return AGENT_BY_NAME.get(name)?.label ?? name;
}

/** 台帳に載っているエージェント名か（AgentTool 委譲＝tool がエージェント名、の判定に使う）。 */
export function isInvestigationAgent(name: string): boolean {
  return AGENT_BY_NAME.has(name);
}

/**
 * いま動いているとみなすエージェント＝最新イベントの実行主体。
 * サブエージェントへの委譲イベント（tool がエージェント名）は委譲先を「実行中」とする。
 */
export function currentAgentName(
  latest: InvestigationProgressView | undefined,
): string | null {
  if (!latest) return null;
  return isInvestigationAgent(latest.tool) ? latest.tool : latest.agent;
}

/**
 * tool 名 → 表示ラベル＋アイコン。AgentTool 委譲（tool がエージェント名）は「◯◯ へ委譲」。
 * 未登録名は生の名前（実イベント優先＝隠さない）。
 */
export function toolMeta(name: string): { label: string; icon: ToolIconName } {
  const tool = TOOL_META[name];
  if (tool) return tool;
  const agent = AGENT_BY_NAME.get(name);
  if (agent) return { label: `${agent.label} へ委譲`, icon: "delegate" };
  return { label: name, icon: "generic" };
}

/**
 * 今回の調査 run に属するイベントだけに絞る。
 * 再調査で同じ Alert に古い run のイベントが残っていても、ANALYZING へ遷移した時刻
 * （alert.updatedAt）以降のイベントだけを見れば現在の run になる（クリア処理を持たない設計）。
 */
export function progressForRun(
  events: readonly InvestigationProgressView[],
  runStartedAt: string,
): InvestigationProgressView[] {
  const since = new Date(runStartedAt).getTime();
  if (Number.isNaN(since)) return [...events];
  return events.filter((e) => {
    const t = new Date(e.at).getTime();
    return !Number.isNaN(t) && t >= since;
  });
}
