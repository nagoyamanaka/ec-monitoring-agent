import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemediationPanel } from "./RemediationPanel";
import type { RemediationApi } from "../infrastructure/remediationApi";
import {
  toRemediationView,
  type RemediationResponsePrimitives,
} from "../domain/RemediationView";
import { makeAlert, makeReport } from "../test-support/alertFixture";

function view(overrides: Partial<RemediationResponsePrimitives> = {}) {
  return toRemediationView({
    alertId: "a-1",
    status: "none",
    pullRequestUrl: null,
    vulnerabilityCount: 0,
    reason: null,
    createdAt: null,
    ...overrides,
  });
}

function fakeApi(initial: ReturnType<typeof view>): RemediationApi {
  return {
    getRemediation: vi.fn().mockResolvedValue(initial),
    draftRemediation: vi.fn().mockResolvedValue(undefined),
  };
}

const remediableAlert = makeAlert({
  id: "a-1",
  report: makeReport({ remediable: true, suggestedActions: [{ text: "依存を更新" }] }),
});

describe("RemediationPanel", () => {
  it("remediable でなく記録も無ければ何も描画しない", async () => {
    const api = fakeApi(view({ status: "none" }));
    const alert = makeAlert({ report: makeReport({ remediable: false }) });
    const { container } = render(<RemediationPanel alert={alert} api={api} />);

    // 取得は走るが、none かつ非 remediable なので最終的に空
    await waitFor(() => expect(api.getRemediation).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("remediable・未起票なら起票ボタンと修正方針を出す", async () => {
    const api = fakeApi(view({ status: "none" }));
    render(<RemediationPanel alert={remediableAlert} api={api} />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "修正を起票" }),
      ).toBeEnabled(),
    );
    expect(screen.getByText("依存を更新")).toBeInTheDocument();
  });

  it("起票ボタン押下で draftRemediation を呼ぶ", async () => {
    const api = fakeApi(view({ status: "none" }));
    render(<RemediationPanel alert={remediableAlert} api={api} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "修正を起票" })).toBeEnabled(),
    );

    await userEvent.click(screen.getByRole("button", { name: "修正を起票" }));
    expect(api.draftRemediation).toHaveBeenCalledWith("a-1", undefined);
  });

  it("drafted は PR リンクと件数を出す", async () => {
    const api = fakeApi(
      view({
        status: "drafted",
        pullRequestUrl: "https://github.com/x/y/pull/3",
        vulnerabilityCount: 2,
      }),
    );
    render(<RemediationPanel alert={remediableAlert} api={api} />);

    await waitFor(() =>
      expect(screen.getByText("修正 PR 作成済み")).toBeInTheDocument(),
    );
    expect(screen.getByText("検出 2 件")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /修正 PR を開く/ }),
    ).toHaveAttribute("href", "https://github.com/x/y/pull/3");
  });

  it("failed は理由を出す", async () => {
    const api = fakeApi(
      view({ status: "failed", reason: "GitHub 未設定" }),
    );
    render(<RemediationPanel alert={remediableAlert} api={api} />);

    await waitFor(() =>
      expect(screen.getByText(/自動修正に失敗しました/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/GitHub 未設定/)).toBeInTheDocument();
  });
});
