import { describe, it, expect } from "vitest";
import {
  buildInvestigationTools,
  InvestigationToolDeps,
} from "./investigationTools.js";
import type {
  AppLogEntry,
  GitCommit,
  GitCommitDiff,
  TerraformDiff,
} from "../../../domain/InfraEvidence.js";
import type { ScoredIncident } from "../../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import type { SimilarIncident } from "../../../../SimilarIncident/domain/SimilarIncident.js";

const ISO = "2026-01-15T12:00:00.000Z";
const DATE = new Date(ISO);

/** FunctionTool.runAsync 経由でツールの execute を呼び出すヘルパー */
function call(
  tool: ReturnType<typeof buildInvestigationTools>[number],
  args: Record<string, unknown>,
) {
  return tool.runAsync({ args, toolContext: {} as never });
}

function makeDeps(
  overrides: Partial<InvestigationToolDeps> = {},
): InvestigationToolDeps {
  return {
    cloudLoggingGateway: { getAppLogs: async () => [] },
    terraformGateway: { getAppliedDiff: async () => null },
    githubGateway: {
      listRecentCommits: async () => [],
      getCommitDiff: async () => null,
    },
    similarIncidentRepository: {
      findSimilar: async () => [],
      index: async () => {},
      removeByAlertId: async () => {},
      search: async () => [],
    },
    ...overrides,
  };
}

function tool(index: number, deps = makeDeps()) {
  return buildInvestigationTools(deps)[index];
}

// ── ツール一覧 ──────────────────────────────────────────────────────────────

describe("buildInvestigationTools", () => {
  it("5つのツールを返し名前が正しい", () => {
    const tools = buildInvestigationTools(makeDeps());
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.name)).toEqual([
      "fetch_app_logs",
      "fetch_terraform_diff",
      "fetch_recent_commits",
      "fetch_commit_diff",
      "search_similar_incidents",
    ]);
  });
});

// ── fetch_app_logs (index 0) ─────────────────────────────────────────────────

describe("fetch_app_logs", () => {
  const LOG: AppLogEntry = {
    timestamp: DATE,
    severity: "ERROR",
    message: "timeout",
    resource: "ec-backend",
  };

  it("AppLogEntry の timestamp を ISO 文字列に変換して返す", async () => {
    const deps = makeDeps({
      cloudLoggingGateway: { getAppLogs: async () => [LOG] },
    });
    const result = await call(tool(0, deps), {
      service: "ec-backend",
      sinceIso: ISO,
    });
    expect(result).toEqual([
      {
        timestamp: ISO,
        severity: "ERROR",
        message: "timeout",
        resource: "ec-backend",
      },
    ]);
  });

  it("windowMinutes が指定されたとき getAppLogs に渡す", async () => {
    let captured: unknown;
    const deps = makeDeps({
      cloudLoggingGateway: {
        getAppLogs: async (params) => {
          captured = params;
          return [];
        },
      },
    });
    await call(tool(0, deps), {
      service: "svc",
      sinceIso: ISO,
      windowMinutes: 10,
    });
    expect((captured as { windowMinutes?: number }).windowMinutes).toBe(10);
  });

  it("windowMinutes が省略されたとき getAppLogs の引数にキーを含めない", async () => {
    let captured: unknown;
    const deps = makeDeps({
      cloudLoggingGateway: {
        getAppLogs: async (params) => {
          captured = params;
          return [];
        },
      },
    });
    await call(tool(0, deps), { service: "svc", sinceIso: ISO });
    expect("windowMinutes" in (captured as object)).toBe(false);
  });

  it("sinceIso の Date 変換が getAppLogs.occurredOn に渡る", async () => {
    let captured: unknown;
    const deps = makeDeps({
      cloudLoggingGateway: {
        getAppLogs: async (params) => {
          captured = params;
          return [];
        },
      },
    });
    await call(tool(0, deps), { service: "svc", sinceIso: ISO });
    expect((captured as { occurredOn: Date }).occurredOn).toEqual(DATE);
  });

  it("sinceIso が不正な日時文字列なら { error } を返す", async () => {
    const result = await call(tool(0), {
      service: "svc",
      sinceIso: "not-a-date",
    });
    expect(result).toEqual({ error: "invalid ISO datetime: not-a-date" });
  });

  it("ゲートウェイが throw したら { error } を返す", async () => {
    const deps = makeDeps({
      cloudLoggingGateway: {
        getAppLogs: async () => {
          throw new Error("network error");
        },
      },
    });
    const result = await call(tool(0, deps), { service: "svc", sinceIso: ISO });
    expect(result).toEqual({ error: "network error" });
  });
});

// ── fetch_terraform_diff (index 1) ──────────────────────────────────────────

describe("fetch_terraform_diff", () => {
  const DIFF: TerraformDiff = {
    resourceChanges: [
      {
        address: "aws_instance.web",
        action: "update",
        attributeDeltas: [
          { key: "instance_type", before: "m5.large", after: "t3.micro" },
        ],
      },
    ],
    appliedAt: "2026-01-01T00:00:00.000Z",
    changedResources: ["aws_instance.web"],
    summary: "EC2 インスタンスタイプ変更",
  };

  it("差分を返す", async () => {
    const deps = makeDeps({
      terraformGateway: { getAppliedDiff: async () => DIFF },
    });
    const result = await call(tool(1, deps), { sinceIso: ISO });
    expect(result).toEqual(DIFF);
  });

  it("null のときフォールバックオブジェクトを返す", async () => {
    const result = await call(tool(1), { sinceIso: ISO });
    expect(result).toEqual({
      resourceChanges: [],
      changedResources: [],
      summary: "適用済みの差分なし",
    });
  });

  it("sinceIso の Date 変換が getAppliedDiff.since に渡る", async () => {
    let captured: unknown;
    const deps = makeDeps({
      terraformGateway: {
        getAppliedDiff: async (params) => {
          captured = params;
          return null;
        },
      },
    });
    await call(tool(1, deps), { sinceIso: ISO });
    expect((captured as { since: Date }).since).toEqual(DATE);
  });

  it("ゲートウェイが throw したら { error } を返す", async () => {
    const deps = makeDeps({
      terraformGateway: {
        getAppliedDiff: async () => {
          throw new Error("tf api error");
        },
      },
    });
    const result = await call(tool(1, deps), { sinceIso: ISO });
    expect(result).toEqual({ error: "tf api error" });
  });
});

// ── fetch_recent_commits (index 2) ──────────────────────────────────────────

describe("fetch_recent_commits", () => {
  const COMMIT: GitCommit = {
    sha: "abc1234",
    message: "fix: timeout",
    author: "dev",
    committedAt: DATE,
  };

  it("GitCommit の committedAt を ISO 文字列に変換して返す", async () => {
    const deps = makeDeps({
      githubGateway: {
        listRecentCommits: async () => [COMMIT],
        getCommitDiff: async () => null,
      },
    });
    const result = await call(tool(2, deps), { sinceIso: ISO });
    expect(result).toEqual([
      {
        sha: "abc1234",
        message: "fix: timeout",
        author: "dev",
        committedAt: ISO,
      },
    ]);
  });

  it("limit が指定されたとき listRecentCommits に渡す", async () => {
    let captured: unknown;
    const deps = makeDeps({
      githubGateway: {
        listRecentCommits: async (params) => {
          captured = params;
          return [];
        },
        getCommitDiff: async () => null,
      },
    });
    await call(tool(2, deps), { sinceIso: ISO, limit: 3 });
    expect((captured as { limit?: number }).limit).toBe(3);
  });

  it("limit が省略されたとき listRecentCommits の引数にキーを含めない", async () => {
    let captured: unknown;
    const deps = makeDeps({
      githubGateway: {
        listRecentCommits: async (params) => {
          captured = params;
          return [];
        },
        getCommitDiff: async () => null,
      },
    });
    await call(tool(2, deps), { sinceIso: ISO });
    expect("limit" in (captured as object)).toBe(false);
  });

  it("ゲートウェイが throw したら { error } を返す", async () => {
    const deps = makeDeps({
      githubGateway: {
        listRecentCommits: async () => {
          throw new Error("gh api error");
        },
        getCommitDiff: async () => null,
      },
    });
    const result = await call(tool(2, deps), { sinceIso: ISO });
    expect(result).toEqual({ error: "gh api error" });
  });
});

// ── fetch_commit_diff (index 3) ─────────────────────────────────────────────

describe("fetch_commit_diff", () => {
  const COMMIT_DIFF: GitCommitDiff = {
    sha: "abc1234",
    message: "fix: connection pool exhaustion",
    author: "dev",
    committedAt: DATE,
    files: [
      {
        filename: "src/db.ts",
        status: "modified",
        additions: 3,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-pool(5)\n+pool(50)",
      },
    ],
  };

  it("GitCommitDiff の committedAt を ISO 文字列に変換して返す", async () => {
    const deps = makeDeps({
      githubGateway: {
        listRecentCommits: async () => [],
        getCommitDiff: async () => COMMIT_DIFF,
      },
    });
    const result = await call(tool(3, deps), { sha: "abc1234" });
    expect(result).toEqual({ ...COMMIT_DIFF, committedAt: ISO });
  });

  it("sha を getCommitDiff に渡す", async () => {
    let captured: unknown;
    const deps = makeDeps({
      githubGateway: {
        listRecentCommits: async () => [],
        getCommitDiff: async (params) => {
          captured = params;
          return null;
        },
      },
    });
    await call(tool(3, deps), { sha: "deadbeef" });
    expect((captured as { sha: string }).sha).toBe("deadbeef");
  });

  it("null のとき取得不可のフォールバックを返す", async () => {
    const result = await call(tool(3), { sha: "unknown" });
    expect(result).toEqual({
      sha: "unknown",
      files: [],
      summary: "差分を取得できなかった（未設定/権限なし/不明な SHA）",
    });
  });

  it("ゲートウェイが throw したら { error } を返す", async () => {
    const deps = makeDeps({
      githubGateway: {
        listRecentCommits: async () => [],
        getCommitDiff: async () => {
          throw new Error("gh api error");
        },
      },
    });
    const result = await call(tool(3, deps), { sha: "abc1234" });
    expect(result).toEqual({ error: "gh api error" });
  });
});

// ── search_similar_incidents (index 4) ──────────────────────────────────────

describe("search_similar_incidents", () => {
  const INCIDENT: SimilarIncident = {
    id: "inc-1",
    eventName: "PaymentTimeout",
    occurredOn: DATE,
    resolvedNote: "DB プール拡張で解消",
    resolvedAt: DATE,
    severity: "CRITICAL" as never,
  };
  const HIT: ScoredIncident = { incident: INCIDENT, score: 0.9 };

  it("ScoredIncident の occurredOn を ISO 文字列に変換して返す", async () => {
    const deps = makeDeps({
      similarIncidentRepository: {
        findSimilar: async () => [],
        index: async () => {},
        removeByAlertId: async () => {},
        search: async () => [HIT],
      },
    });
    const result = await call(tool(4, deps), {
      eventName: "PaymentTimeout",
      text: "タイムアウト",
    });
    expect(result).toEqual([
      {
        eventName: "PaymentTimeout",
        occurredOn: ISO,
        resolvedNote: "DB プール拡張で解消",
        score: 0.9,
      },
    ]);
  });

  it("limit 省略時はデフォルト 5 を search に渡す", async () => {
    let captured: unknown;
    const deps = makeDeps({
      similarIncidentRepository: {
        findSimilar: async () => [],
        index: async () => {},
        removeByAlertId: async () => {},
        search: async (q) => {
          captured = q;
          return [];
        },
      },
    });
    await call(tool(4, deps), {
      eventName: "PaymentTimeout",
      text: "タイムアウト",
    });
    expect((captured as { limit: number }).limit).toBe(5);
  });

  it("limit 指定時はその値を search に渡す", async () => {
    let captured: unknown;
    const deps = makeDeps({
      similarIncidentRepository: {
        findSimilar: async () => [],
        index: async () => {},
        removeByAlertId: async () => {},
        search: async (q) => {
          captured = q;
          return [];
        },
      },
    });
    await call(tool(4, deps), {
      eventName: "PaymentTimeout",
      text: "タイムアウト",
      limit: 2,
    });
    expect((captured as { limit: number }).limit).toBe(2);
  });

  it("リポジトリが throw したら { error } を返す", async () => {
    const deps = makeDeps({
      similarIncidentRepository: {
        findSimilar: async () => [],
        index: async () => {},
        removeByAlertId: async () => {},
        search: async () => {
          throw new Error("vector db error");
        },
      },
    });
    const result = await call(tool(4, deps), {
      eventName: "PaymentTimeout",
      text: "タイムアウト",
    });
    expect(result).toEqual({ error: "vector db error" });
  });
});
