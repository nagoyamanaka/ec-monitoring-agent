import type { TerraformDiff } from "./InfraEvidence.js";

/**
 * 調査中にエージェントのツール（evidence_collector の read-only ツール）が**実際に取得できた**証拠。
 *
 * 事前収集（InfraEvidence）と同じ Gateway が返した値だけを記録する＝LLM の文章は一切入らない。
 * これを引用の照合語彙（ゲート / 表示カタログ）に足すことで、「AI が自分で掘った証拠」も
 * 事前収集と同じ基準（Gateway が返した値に一致するか）で照合できる。
 * - LLM が渡した引数（架空 sha 等）は記録しない。Gateway が null を返した・例外を投げた呼び出しも記録しない。
 * - appLogs / 類似事例は記録しない（ゲートの語彙方針と同じ・CitedEvidence 参照）。
 */
export type ToolObservedCommit = {
  readonly sha: string;
  readonly url?: string;
};

export type ToolObservedEvidence = {
  readonly commits: readonly ToolObservedCommit[];
  readonly terraformDiffs: readonly TerraformDiff[];
};

export const EMPTY_TOOL_OBSERVED_EVIDENCE: ToolObservedEvidence = {
  commits: [],
  terraformDiffs: [],
};
