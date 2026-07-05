import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubGatewayImpl } from "./GitHubGatewayImpl.js";

// GitHub REST の commits 一覧レスポンス（必要フィールドのみ）を返す fetch スタブ。
function stubCommits(
  commits: Array<{ sha: string; message: string; html_url?: string }>,
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify(
          commits.map((c) => ({
            sha: c.sha,
            ...(c.html_url ? { html_url: c.html_url } : {}),
            commit: {
              message: c.message,
              author: { name: "tester", date: "2026-06-30T06:29:00.000Z" },
            },
          })),
        ),
        { status: 200 },
      ),
    ),
  );
}

describe("GitHubGatewayImpl.listRecentCommits", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("commitPrLinks に一致する短縮 sha のコミットへ relatedPullRequests を付与する", async () => {
    stubCommits([
      { sha: "e12b655abcdef", message: "perf: 退行", html_url: "https://gh/commit/e12b655" },
      { sha: "0000000ffffff", message: "無関係" },
    ]);
    const gateway = new GitHubGatewayImpl("tok", "owner/repo", "demo/regression", {
      e12b655: [
        { url: "https://gh/pull/62", label: "原因PR（マージ済）" },
        { url: "https://gh/pull/63", label: "revert PR" },
      ],
    });

    const commits = await gateway.listRecentCommits({ since: new Date() });

    expect(commits[0].sha).toBe("e12b655");
    expect(commits[0].relatedPullRequests).toEqual([
      { url: "https://gh/pull/62", label: "原因PR（マージ済）" },
      { url: "https://gh/pull/63", label: "revert PR" },
    ]);
    // 一致しないコミットには付与しない（過剰なリンク混入を避ける）。
    expect(commits[1].relatedPullRequests).toBeUndefined();
  });

  it("map 未指定（本番/未設定）なら relatedPullRequests を付けない", async () => {
    stubCommits([{ sha: "e12b655abcdef", message: "perf: 退行" }]);
    const gateway = new GitHubGatewayImpl("tok", "owner/repo", "demo/regression");

    const commits = await gateway.listRecentCommits({ since: new Date() });

    expect(commits[0].relatedPullRequests).toBeUndefined();
  });
});
