import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AnalyticsPage } from "./AnalyticsPage";
import type { AnalyticsApi } from "../../infrastructure/analyticsApi";
import {
  toAnalyticsView,
  type AnalyticsDto,
  type ApprovedAlertSummaryDto,
} from "../../domain/AnalyticsView";

function approved(
  over: Partial<ApprovedAlertSummaryDto> = {},
): ApprovedAlertSummaryDto {
  return {
    id: "alert-42",
    eventName: "ec.checkout.latency_degraded",
    category: "application",
    severity: "WARNING",
    classificationType: "unknown",
    patternName: "DB_CONNECTION_POOL_EXHAUSTION",
    occurredOn: "2026-06-20T11:20:00.000Z",
    occurrenceCount: 1,
    operatorNote: "セール時間帯のみプールを一時増強して回避",
    ...over,
  };
}

function fakeApi(dto: Partial<AnalyticsDto> = {}): AnalyticsApi {
  const full: AnalyticsDto = {
    totalAlerts: 7,
    knownCount: 4,
    unknownCount: 3,
    withFeedbackCount: 2,
    correctCount: 2,
    incorrectCount: 0,
    accuracy: 1,
    approvedAlerts: [approved()],
    promotedPatternCount: 2,
    ...dto,
  };
  return { getAnalytics: vi.fn().mockResolvedValue(toAnalyticsView(full)) };
}

function renderPage(api: AnalyticsApi) {
  return render(
    <MemoryRouter initialEntries={["/analytics"]}>
      <AnalyticsPage api={api} />
    </MemoryRouter>,
  );
}

describe("AnalyticsPage 学習の軌跡ヒーロー", () => {
  it("代表アラートを未知→承認→既知のライフサイクルで描く", async () => {
    renderPage(fakeApi());
    const hero = await screen.findByRole("heading", { name: "1件の学習の軌跡" });
    const card = hero.closest("div");
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    expect(scope.getByText("未知")).toBeInTheDocument();
    expect(scope.getByText("承認")).toBeInTheDocument();
    expect(scope.getByText("既知")).toBeInTheDocument();
    expect(
      scope.getByText(/AI 推定: DB_CONNECTION_POOL_EXHAUSTION/),
    ).toBeInTheDocument();
  });

  it("AI調査ステップが該当アラート詳細へ深リンクする（唯一の深リンク）", async () => {
    renderPage(fakeApi());
    const link = await screen.findByRole("link", { name: /AI 調査/ });
    expect(link).toHaveAttribute("href", "/alerts?focus=alert-42");
  });

  it("knownCount を「AIを呼ばず即確定」として提示する（vanity%は出さない）", async () => {
    renderPage(fakeApi({ knownCount: 4 }));
    const hero = await screen.findByRole("heading", { name: "1件の学習の軌跡" });
    const scope = within(hero.closest("div") as HTMLElement);
    expect(scope.getByText("4")).toBeInTheDocument();
    expect(scope.getByText(/AI を呼ばず即確定/)).toBeInTheDocument();
    // seed 依存の vanity% を大書きしない（数字のハルシネーション批判の的）。
    expect(scope.queryByText(/%/)).toBeNull();
  });

  it("代表がいなければ empty state に劣化する", async () => {
    renderPage(fakeApi({ approvedAlerts: [] }));
    await waitFor(() =>
      expect(
        screen.getByText(/まだ学習の軌跡がありません/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("heading", { name: "1件の学習の軌跡" }),
    ).toBeNull();
  });
});
