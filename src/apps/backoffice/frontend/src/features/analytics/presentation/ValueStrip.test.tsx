import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ValueStrip } from "./ValueStrip";
import type { AnalyticsApi } from "../infrastructure/analyticsApi";
import { toAnalyticsView } from "../domain/AnalyticsView";

function fakeApi(overrides: Partial<AnalyticsApi> = {}): AnalyticsApi {
  return {
    getAnalytics: vi.fn().mockResolvedValue(
      toAnalyticsView({
        totalAlerts: 7,
        knownCount: 4,
        unknownCount: 3,
        withFeedbackCount: 2,
        correctCount: 2,
        incorrectCount: 0,
        accuracy: 1,
        promotedPatternCount: 2,
      }),
    ),
    ...overrides,
  };
}

function renderStrip(api: AnalyticsApi) {
  return render(
    <MemoryRouter initialEntries={["/alerts"]}>
      <Routes>
        <Route path="/alerts" element={<ValueStrip api={api} />} />
        <Route path="/analytics" element={<div>Analytics ページ</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ValueStrip", () => {
  it("Analytics の実データ（トリアージ/既知即決/AI調査/昇格）を件数で出す", async () => {
    renderStrip(fakeApi());
    await waitFor(() =>
      expect(screen.getByText("自動トリアージ")).toBeInTheDocument(),
    );
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("既知即決")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("AI 調査")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("昇格パターン")).toBeInTheDocument();
  });

  it("累計であることの注記（過去実績含む）を出す＝リセット直後の空一覧と矛盾して見せない", async () => {
    renderStrip(fakeApi());
    await waitFor(() =>
      expect(screen.getByText("※過去実績含む")).toBeInTheDocument(),
    );
  });

  it("クリックで Analytics ページへ遷移する", async () => {
    renderStrip(fakeApi());
    await waitFor(() =>
      expect(screen.getByText("自動トリアージ")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Analytics ページ")).toBeInTheDocument();
  });

  it("取得失敗時は何も出さない（一覧を邪魔しない）", async () => {
    const api = fakeApi({
      getAnalytics: vi.fn().mockRejectedValue(new Error("HTTP 500")),
    });
    const { container } = renderStrip(api);
    await waitFor(() => expect(api.getAnalytics).toHaveBeenCalled());
    expect(container.querySelector("button")).toBeNull();
  });
});
