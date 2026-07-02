import { describe, it, expect, vi, beforeEach } from "vitest";
import { PullRequestSignalSource } from "./PullRequestSignalSource.js";
import { PendingPlanSignalSource } from "./PendingPlanSignalSource.js";
import { ScheduleSignalSource } from "./ScheduleSignalSource.js";
import { GitHubGateway } from "../../AIInvestigation/infrastructure/infrainvestigation/GitHubGateway.js";
import { TerraformGateway } from "../../AIInvestigation/infrastructure/infrainvestigation/TerraformGateway.js";
import { ScheduleSource } from "../domain/ScheduleSource.js";
import { ConsoleLogger } from "../../../Shared/infrastructure/logging/ConsoleLogger.js";

let logger: ConsoleLogger;

beforeEach(() => {
  logger = new ConsoleLogger();
  vi.spyOn(logger, "write").mockResolvedValue(undefined);
});

const fakeGitHub = (overrides: Partial<GitHubGateway> = {}): GitHubGateway => ({
  listRecentCommits: async () => [],
  getCommitDiff: async () => null,
  listOpenPullRequests: async () => [],
  ...overrides,
});

const fakeTerraform = (
  overrides: Partial<TerraformGateway> = {},
): TerraformGateway => ({
  getAppliedDiff: async () => null,
  getPendingPlan: async () => [],
  ...overrides,
});

describe("PullRequestSignalSource", () => {
  it("open PR を FUTURE_CHANGE シグナルに正規化する（subject はタイトル由来）", async () => {
    const gateway = fakeGitHub({
      listOpenPullRequests: async () => [
        {
          number: 123,
          title: "Shrink DB pool 100 to 40",
          author: "dev",
          updatedAt: new Date("2026-07-01T00:00:00Z"),
          headRef: "chore/shrink-db-pool",
          draft: false,
          url: "https://github.com/o/r/pull/123",
        },
      ],
    });

    const signals = await new PullRequestSignalSource(gateway, logger).collect("今週末");

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      id: "pr-123",
      kind: "FUTURE_CHANGE",
      subject: "shrink_db_pool_100_to_40",
      desc: "Shrink DB pool 100 to 40",
      source: "github.pr#123",
      url: "https://github.com/o/r/pull/123",
    });
  });

  it("和文タイトルで subject が潰れたらブランチ名にフォールバックする", async () => {
    const gateway = fakeGitHub({
      listOpenPullRequests: async () => [
        {
          number: 7,
          title: "プール縮小",
          author: "dev",
          updatedAt: new Date("2026-07-01T00:00:00Z"),
          headRef: "chore/shrink-db-pool",
          draft: true,
          url: "https://github.com/o/r/pull/7",
        },
      ],
    });

    const signals = await new PullRequestSignalSource(gateway, logger).collect("今週末");

    expect(signals[0].subject).toBe("chore_shrink_db_pool");
    expect(signals[0].desc).toBe("[draft] プール縮小");
  });

  it("gateway が throw したら空で縮退する（予報全体を落とさない）", async () => {
    const gateway = fakeGitHub({
      listOpenPullRequests: async () => {
        throw new Error("gh api error");
      },
    });

    expect(await new PullRequestSignalSource(gateway, logger).collect("今週末")).toEqual([]);
  });
});

describe("PendingPlanSignalSource", () => {
  it("未適用 plan を FUTURE_CHANGE に正規化する（subject は先頭リソースアドレス由来）", async () => {
    const gateway = fakeTerraform({
      getPendingPlan: async () => [
        {
          resourceChanges: [
            {
              address: "google_sql_database_instance.main",
              action: "update",
              attributeDeltas: [{ key: "max_connections", before: "100", after: "40" }],
            },
          ],
          plannedAt: new Date("2026-07-01T00:00:00Z"),
          summary: "cloudsql max_connections 100→40 縮小",
          url: "https://github.com/o/r/actions/runs/1",
        },
      ],
    });

    const signals = await new PendingPlanSignalSource(gateway, logger).collect("今週末");

    expect(signals[0]).toMatchObject({
      id: "plan-1",
      kind: "FUTURE_CHANGE",
      subject: "google_sql_database_instance_main",
      desc: "cloudsql max_connections 100→40 縮小",
      source: "terraform.plan",
      url: "https://github.com/o/r/actions/runs/1",
    });
  });

  it("gateway が throw したら空で縮退する", async () => {
    const gateway = fakeTerraform({
      getPendingPlan: async () => {
        throw new Error("tf api error");
      },
    });

    expect(await new PendingPlanSignalSource(gateway, logger).collect("今週末")).toEqual([]);
  });
});

describe("ScheduleSignalSource", () => {
  it("スケジュール枠を SCHEDULE に正規化し horizon を渡す", async () => {
    let captured: string | undefined;
    const source: ScheduleSource = {
      list: async (horizon) => {
        captured = horizon;
        return [{ subject: "checkout", when: "Sat 20:00-23:00", load: "x5 (セール)" }];
      },
    };

    const signals = await new ScheduleSignalSource(source, logger).collect("今週末");

    expect(captured).toBe("今週末");
    expect(signals[0]).toMatchObject({
      id: "sch-1",
      kind: "SCHEDULE",
      subject: "checkout",
      when: "Sat 20:00-23:00",
      desc: "checkout 負荷 x5 (セール)",
      source: "schedule",
    });
  });

  it("source が throw したら空で縮退する", async () => {
    const source: ScheduleSource = {
      list: async () => {
        throw new Error("seed load error");
      },
    };

    expect(await new ScheduleSignalSource(source, logger).collect("今週末")).toEqual([]);
  });
});
