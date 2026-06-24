import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { ReinvestigateAlertCommand } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/ReinvestigateAlert/ReinvestigateAlertCommand.js";

// 自由記述の指摘長の上限。プロンプト水増し/トークン爆発の安価な防御（境界での最低限のガードレール）。
// 攻撃的入力の意味的な防御は LLM プロバイダ側＋ADK 多エージェント（step4-2 タスク18）に委ねる。
// operatorNote は LLM 文脈に「データ」として渡るだけで、決定的な制御や write 実行には使わない
// （write は人間承認＋executor の deterministic 判定が握る）ため残存リスクは低い。
const MAX_OPERATOR_NOTE_LENGTH = 2000;

// POST /alerts/:id/reinvestigate
// 人間の指摘（operatorNote）を添えて AI 再調査をキックする。調査は非同期に進み、
// 結果（ANALYZING→OPEN ＋ 新レポート）は SSE で push されるため 202 を返す（CQRS 分離）。
export class AlertReinvestigatePostController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operatorNote } = req.body as { operatorNote?: string };
      const note = operatorNote?.trim();
      if (!note) {
        res
          .status(400)
          .json({ error: "operatorNote は必須です（再調査の指摘内容）" });
        return;
      }
      if (note.length > MAX_OPERATOR_NOTE_LENGTH) {
        res.status(400).json({
          error: `operatorNote は ${MAX_OPERATOR_NOTE_LENGTH} 文字以内にしてください`,
        });
        return;
      }
      await this.commandBus.dispatch(
        new ReinvestigateAlertCommand(req.params.id, note),
      );
      res.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  }
}
