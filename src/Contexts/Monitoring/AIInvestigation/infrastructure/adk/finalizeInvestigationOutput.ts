import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { parseLLMOutput, rawSnippet } from "../aiinvestigation/LLMOutputParser.js";
import type {
  InvestigationFinalizer,
  InvestigationTranscript,
} from "./InvestigationFinalizer.js";

/** どちらのテキストを採用したか。ランナーの完了ログに載せて本番での採用率を観測する。 */
export type FinalizationSource = "finalizer" | "coordinator";

export type FinalizationOutcome = {
  readonly text: string;
  readonly source: FinalizationSource;
};

/**
 * エージェントループ終了後の清書と、その縮退判断（ADR-26 恒久策の要）。
 *
 * 設計の芯は「finalizer は**使える JSON を出したときだけ**勝つ」こと。清書は既定で毎回走らせるが、
 * 出力がパースを通らなければコーディネーターの下書きへ黙って戻す。したがってこの段は
 * **現行より悪くなり得ない**——finalizer が死んでも、その先には従来どおりサルベージパースと
 * 縮退リトライ（ADR-26 現行防御）が残っている。
 *
 * 「失敗したときだけ清書する」設計にしなかったのは、それだと fallback の層を1枚足しただけで
 * 「熟考する仕事と JSON を書き出す仕事を分ける」という構造の分離にならないため。分離が常時
 * 効いていて初めて、空応答という機序そのものが正常系から消える。
 */
export async function finalizeInvestigationOutput(params: {
  /** 未注入なら清書なし＝従来どおりコーディネーターの最終テキストをそのまま使う。 */
  readonly finalizer?: InvestigationFinalizer;
  readonly transcript: InvestigationTranscript;
  readonly logger: Logger;
}): Promise<FinalizationOutcome> {
  const { finalizer, transcript, logger } = params;
  const draft: FinalizationOutcome = {
    text: transcript.coordinatorFinalText,
    source: "coordinator",
  };
  if (!finalizer) return draft;

  let finalized: string;
  try {
    finalized = await finalizer.finalize(transcript);
  } catch (error) {
    await logger.warn({
      service: "backoffice-backend",
      action: "ai_investigation_finalizer_failed",
      message: `最終JSONの清書(finalizer)が例外で失敗したためコーディネーターの下書きへ縮退します: draftLen=${draft.text.length}, subAgentOutputs=${transcript.subAgentOutputs.length}, error=${error instanceof Error ? error.message : String(error)}`,
    });
    return draft;
  }

  // 採用条件はパースを通ること。構造化出力でも「スキーマは満たすが中身が空」等はあり得るので、
  // 検証側（parseLLMOutput）を単一の合否判定にして、生成側の主張を鵜呑みにしない。
  if (parseLLMOutput(finalized)) {
    return { text: finalized, source: "finalizer" };
  }

  await logger.warn({
    service: "backoffice-backend",
    action: "ai_investigation_finalizer_unusable",
    message: `最終JSONの清書(finalizer)がパースを通らなかったためコーディネーターの下書きへ縮退します: finalizedLen=${finalized.length}, draftLen=${draft.text.length}, finalizedSnippet=${rawSnippet(finalized)}`,
  });
  return draft;
}
