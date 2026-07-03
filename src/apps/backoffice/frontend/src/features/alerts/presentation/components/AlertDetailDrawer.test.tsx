import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AlertDetailDrawer } from "./AlertDetailDrawer";
import { makeAlert, makeReport } from "../../test-support/alertFixture";

function renderDrawer(props: Parameters<typeof AlertDetailDrawer>[0]) {
  return render(
    <MemoryRouter>
      <AlertDetailDrawer {...props} />
    </MemoryRouter>,
  );
}

describe("AlertDetailDrawer", () => {
  it("alert=null なら何も描画しない", () => {
    const { container } = renderDrawer({ alert: null, onClose: vi.fn() });
    expect(container.firstChild).toBeNull();
  });

  it("ヘッダ・確信度・本体（summary/承認）を表示する", () => {
    renderDrawer({ alert: makeAlert(), onClose: vi.fn() });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("latency.spike")).toBeInTheDocument();
    expect(screen.getByText("AI 確信度")).toBeInTheDocument();
    expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /承認/ })).toBeInTheDocument();
  });

  it("✕ クリックで onClose を呼ぶ", async () => {
    const onClose = vi.fn();
    renderDrawer({ alert: makeAlert(), onClose });
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape キーで onClose を呼ぶ", async () => {
    const onClose = vi.fn();
    renderDrawer({ alert: makeAlert(), onClose });
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("未知（AI調査対象）アラートは証拠パネルを出す", () => {
    const evidenceApi = { getEvidence: vi.fn().mockResolvedValue(null) };
    renderDrawer({ alert: makeAlert(), onClose: vi.fn(), evidenceApi });
    expect(screen.getByText("収集した証拠")).toBeInTheDocument();
  });

  it("既知（完全一致）アラートは証拠パネルを出さない（解析中表示も出さない）", () => {
    const evidenceApi = { getEvidence: vi.fn().mockResolvedValue(null) };
    renderDrawer({
      alert: makeAlert({
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-1",
          patternName: "決済タイムアウト",
          confidence: 0.9,
          matchedConditions: [],
        },
      }),
      onClose: vi.fn(),
      evidenceApi,
    });
    expect(screen.queryByText("収集した証拠")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/証拠を解析しています/),
    ).not.toBeInTheDocument();
    expect(evidenceApi.getEvidence).not.toHaveBeenCalled();
  });

  it("onDecision を alert id・decision 付きで呼ぶ", async () => {
    const onDecision = vi.fn().mockResolvedValue(undefined);
    renderDrawer({
      alert: makeAlert({ id: "a-9", report: makeReport() }),
      onClose: vi.fn(),
      onDecision,
    });
    await userEvent.click(screen.getByRole("button", { name: /承認/ }));
    expect(onDecision).toHaveBeenCalledWith("a-9", "approve", undefined);
  });

  it("fallback レポートは警告バナー直下の「再調査を実行」で onReinvestigate を呼ぶ（タスク E3）", async () => {
    const onReinvestigate = vi.fn().mockResolvedValue(undefined);
    renderDrawer({
      alert: makeAlert({
        report: makeReport({ isFallback: true, suggestedPatternName: "" }),
      }),
      onClose: vi.fn(),
      onReinvestigate,
    });

    expect(screen.getByText("AI 調査に失敗・暫定表示")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /再調査を実行/ }));
    expect(onReinvestigate).toHaveBeenCalledWith(
      "alert-1",
      expect.stringContaining("失敗"),
    );
  });

  it("詳細ページへのリンクを出す", () => {
    renderDrawer({ alert: makeAlert({ id: "a-9" }), onClose: vi.fn() });
    expect(
      screen.getByRole("link", { name: /詳細ページ/ }),
    ).toHaveAttribute("href", "/alerts/a-9");
  });

  it("レポートがあればフッターに詳細ページのティザー（チップ＋推奨アクション抜粋）を出す", () => {
    renderDrawer({ alert: makeAlert(), onClose: vi.fn() });
    const link = screen.getByRole("link", { name: /AI レポート全文/ });
    expect(link).toHaveAttribute("href", "/alerts/alert-1");
    expect(link).toHaveTextContent("調査ステップ 2");
    expect(link).toHaveTextContent("推奨アクション 2");
    expect(link).toHaveTextContent("ロールバック");
    expect(link).toHaveTextContent("詳細ページで全文を読む");
  });

  it("レポートが無ければフッターは素の詳細ページリンクにフォールバックする", () => {
    renderDrawer({
      alert: makeAlert({ id: "a-9", report: null }),
      onClose: vi.fn(),
    });
    const link = screen.getByRole("link", { name: "詳細ページを開く →" });
    expect(link).toHaveAttribute("href", "/alerts/a-9");
    expect(screen.queryByText("AI レポート全文")).not.toBeInTheDocument();
  });
});
