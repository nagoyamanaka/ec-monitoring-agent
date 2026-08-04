import { Command } from "../../../../Shared/domain/Command.js";
import type { ReviewDecision } from "../../domain/Alert.js";

export class SubmitFeedbackCommand extends Command {
  constructor(
    readonly alertId: string,
    readonly isCorrect: boolean,
    readonly operatorNote?: string,
    // 人間が選んだ決裁（acted / deferred / rejected）。未指定は isCorrect からの導出になる。
    readonly decision?: ReviewDecision,
  ) {
    super();
  }
}
