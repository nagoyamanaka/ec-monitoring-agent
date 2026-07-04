import {
  INVESTIGATION_AGENTS,
  type AgentInfo,
} from "./investigationProgress";

/**
 * 調査ステップ本文の人間語化（タスク E8-B）。
 * LLM が返すステップ文には ADK の生エージェント名（`root_cause_analyst` 等）が混ざる。
 * 表示時に台帳（INVESTIGATION_AGENTS）の label へ写像し、生 ID の露出を避ける
 * （E2「生 ID の人間化」と同方針・一致しない部分は原文のまま＝防御的）。
 */

const AGENT_NAME_PATTERN = new RegExp(
  INVESTIGATION_AGENTS.map((a) => a.name).join("|"),
  "g",
);

const LABEL_BY_NAME = new Map(
  INVESTIGATION_AGENTS.map((a) => [a.name, a.label]),
);

export function humanizeAgentNames(text: string): string {
  return text.replace(
    AGENT_NAME_PATTERN,
    (name) => LABEL_BY_NAME.get(name) ?? name,
  );
}

/**
 * 調査ステップ本文に登場したエージェントを台帳順で返す（E8-A の AI 調査ノード・ホバー台帳用）。
 * 判定はレポート自身のステップ文（実データ）に生エージェント名が含まれるか＝決定論。
 * ステップがエージェントに言及しない形式でも壊れない（空配列＝台帳をハイライト無しで出す側の劣化）。
 */
export function mentionedAgents(
  stepTexts: readonly string[],
): readonly AgentInfo[] {
  return INVESTIGATION_AGENTS.filter((agent) =>
    stepTexts.some((text) => text.includes(agent.name)),
  );
}
