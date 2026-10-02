import { AsyncLocalStorage } from "node:async_hooks";
import type { GitCommit, TerraformDiff } from "../../../domain/InfraEvidence.js";
import type {
  ToolObservedCommit,
  ToolObservedEvidence,
} from "../../../domain/ToolObservedEvidence.js";

/**
 * 1回の調査（runner.run）の間にツールが実取得した証拠を貯める入れ物。
 *
 * ADK の AgentTool はサブエージェントを入れ子の Runner で回すため、evidence_collector の
 * ツール応答は外側のイベントストリームに出てこない（agent_tool.js は最終テキストしか返さない）。
 * なのでイベントから拾うのではなく、ツール自身が Gateway の戻り値をここへ記録する。
 * ツールはランナーの constructor で1度だけ組まれ調査間で共有されるので、調査ごとの入れ物は
 * AsyncLocalStorage で渡す（並行する調査の記録が混ざらない）。
 */
export class ToolObservationLog {
  private readonly commits = new Map<string, ToolObservedCommit>();
  private readonly terraformDiffs: TerraformDiff[] = [];

  recordCommit(commit: Pick<GitCommit, "sha" | "url">): void {
    if (commit.sha.trim() === "" || this.commits.has(commit.sha)) return;
    this.commits.set(commit.sha, {
      sha: commit.sha,
      ...(commit.url ? { url: commit.url } : {}),
    });
  }

  recordTerraformDiff(diff: TerraformDiff): void {
    this.terraformDiffs.push(diff);
  }

  snapshot(): ToolObservedEvidence {
    return {
      commits: [...this.commits.values()],
      terraformDiffs: [...this.terraformDiffs],
    };
  }
}

const storage = new AsyncLocalStorage<ToolObservationLog>();

/** fn の実行中（そこから派生した非同期処理を含む）にツールが記録した証拠を集める。 */
export function runWithToolObservations<T>(
  log: ToolObservationLog,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(log, fn);
}

/** 実行中の調査の入れ物。スコープ外（UT で単体のツールを叩く等）は undefined＝記録しない。 */
export function currentToolObservationLog(): ToolObservationLog | undefined {
  return storage.getStore();
}
