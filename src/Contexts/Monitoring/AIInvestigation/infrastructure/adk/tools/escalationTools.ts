import { FunctionTool } from "@google/adk";
// ADK(@google/adk) は zod@4 依存。FunctionTool は zod/v4 名前空間の ZodObject を期待するため
// 同一 zod コピーの zod/v4 から import する（investigationTools と同方針）。
import { z } from "zod/v4";
import { EscalationDirectory } from "../../../domain/escalation/EscalationDirectory.js";

/**
 * RunbookEscalationAgent が使う「読み取り専用」ツール（ADK FunctionTool）。タスク35。
 *
 * 体制マスタ（EscalationDirectory）を affectedSubjects で引き、エスカレーション宛先候補を返す。
 * write は持たせない（通知送信・チケット起票はしない＝草案までに閉じる）。失敗は throw せず
 * { error } を返してエージェントの草案化を継続させる（investigationTools と同方針）。
 */
export type EscalationToolDeps = {
  readonly escalationDirectory: EscalationDirectory;
};

async function bestEffort<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildEscalationTools(deps: EscalationToolDeps): FunctionTool[] {
  const findEscalationOwners = new FunctionTool({
    name: "find_escalation_owners",
    description:
      "影響を受けた主体（サービス名・ドメイン語）から、エスカレーション先のチーム/担当者/連絡先/SLA を読み取り専用で引く。他責・運用案件の宛先を裏付けるのに使う。",
    parameters: z.object({
      subjects: z
        .array(z.string())
        .describe("影響を受けた主体（impact.affectedSubjects）。例: ['payment', 'checkout']"),
    }),
    execute: ({ subjects }) =>
      bestEffort(async () => {
        const owners = await deps.escalationDirectory.findBySubjects(subjects);
        return owners.map((o) => ({
          team: o.team,
          owner: o.owner,
          contact: o.contact,
          slaTier: o.slaTier,
          ownsSubjects: o.ownsSubjects,
        }));
      }),
  });

  return [findEscalationOwners];
}
