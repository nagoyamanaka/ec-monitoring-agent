import { Command } from "../../../../Shared/domain/Command.js";

// 人間の指摘（operatorNote＝前回調査の誤り・どう直すか）を添えて AI 再調査をキックする
// write コマンド。二値フィードバック（承認/却下）とは独立した「やり直し」の経路。
export class ReinvestigateAlertCommand extends Command {
  constructor(
    readonly alertId: string,
    readonly operatorNote: string,
  ) {
    super();
  }
}
