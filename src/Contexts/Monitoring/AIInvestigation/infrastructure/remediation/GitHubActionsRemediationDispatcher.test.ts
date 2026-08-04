import { describe, it, expect, vi, afterEach } from "vitest";
import { GitHubActionsRemediationDispatcher } from "./GitHubActionsRemediationDispatcher.js";

const INPUT = {
  alertId: "alert-1",
  repo: "owner/repo",
  vulnerabilities: [
    { cveId: "CVE-2024-AAAA", severity: "HIGH", package: "axios", version: "1.6.0", fixedVersion: "1.7.4" },
  ],
};

function stubFetch(ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 204 : 422,
    text: async () => (ok ? "" : "bad request"),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function clientPayload(fetchMock: ReturnType<typeof stubFetch>): Record<string, unknown> {
  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
    client_payload: Record<string, unknown>;
  };
  return body.client_payload;
}

/**
 * ここで固定しているのは ai-remediation.yml との契約（client_payload の形）。
 * ワークフロー側はこの環境から実行できないので、送る側だけでも形を落とさないようにする。
 */
describe("GitHubActionsRemediationDispatcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("baseRef を client_payload に載せる（CI の checkout ref ＝ PR の base）", async () => {
    const fetchMock = stubFetch();
    const dispatcher = new GitHubActionsRemediationDispatcher(
      "token",
      "owner/repo",
      "ai-remediation",
      2,
      "demo/security-baseline",
    );

    const outcome = await dispatcher.execute(INPUT);

    expect(outcome).toEqual({ kind: "dispatched" });
    expect(clientPayload(fetchMock)).toMatchObject({
      alertId: "alert-1",
      maxAttempts: 2,
      baseRef: "demo/security-baseline",
    });
  });

  it("baseRef 未設定なら空で送る（CI 側が既定ブランチへフォールバックする）", async () => {
    const fetchMock = stubFetch();
    const dispatcher = new GitHubActionsRemediationDispatcher("token", "owner/repo");

    await dispatcher.execute(INPUT);

    expect(clientPayload(fetchMock).baseRef).toBe("");
  });

  it("token/repo 未設定なら dispatch せず failed（設定漏れを黙って成功にしない）", async () => {
    const fetchMock = stubFetch();
    const dispatcher = new GitHubActionsRemediationDispatcher("", "");

    expect(await dispatcher.execute(INPUT)).toMatchObject({ kind: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GitHub が非 2xx を返したら failed（理由にステータスを残す）", async () => {
    stubFetch(false);
    const dispatcher = new GitHubActionsRemediationDispatcher("token", "owner/repo");

    const outcome = await dispatcher.execute(INPUT);

    expect(outcome.kind).toBe("failed");
    expect(outcome.kind === "failed" && outcome.reason).toContain("422");
  });
});
