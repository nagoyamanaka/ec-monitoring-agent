import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TerraformDiff } from "../../domain/InfraEvidence.js";
import { TerraformGateway } from "./TerraformGateway.js";

const execFileAsync = promisify(execFile);

// IaC リポジトリの git log で Terraform 変更履歴を収集する（読み取り専用）。
// TERRAFORM_REPO_PATH が未設定の場合はスキップする。
export class TerraformGatewayImpl implements TerraformGateway {
  constructor(
    private readonly repoPath: string = process.env.TERRAFORM_REPO_PATH ?? "",
  ) {}

  async getAppliedDiff(params: { since: Date }): Promise<TerraformDiff | null> {
    if (!this.repoPath) return null;

    try {
      const sinceIso = params.since.toISOString();
      const { stdout } = await execFileAsync(
        "git",
        [
          "-C", this.repoPath,
          "log",
          `--since=${sinceIso}`,
          "--oneline",
          "--name-only",
          "--diff-filter=AM",
          "--",
          "*.tf",
        ],
        { timeout: 5000 },
      );

      if (!stdout.trim()) return null;

      const lines = stdout.trim().split("\n");
      const changedResources = lines.filter((l) => l.endsWith(".tf"));

      return {
        changedResources,
        summary: `${changedResources.length} Terraform ファイルが変更されました`,
      };
    } catch {
      return null;
    }
  }
}
