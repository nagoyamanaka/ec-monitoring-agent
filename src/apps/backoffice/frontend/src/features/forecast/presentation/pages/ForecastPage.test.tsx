import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HttpError } from "@shared/api/HttpClient";
import type {
  ForecastApi,
  ForecastSnapshot,
} from "../../infrastructure/forecastApi";
import type { ForecastBriefingView } from "../../domain/ForecastView";
import { ForecastProvider } from "../ForecastProvider";
import { ForecastPage } from "./ForecastPage";

const BRIEFING: ForecastBriefingView = {
  forecastId: "f-1",
  generatedAt: "2026-07-03T10:00:00.000Z",
  horizon: "今週末",
  isFallback: false,
  signalCount: 3,
  highRiskCount: 1,
  risks: [
    {
      window: "土曜 20:00-22:00",
      subject: "DB 接続プール枯渇",
      level: "HIGH",
      confidence: 0.8,
      reasoning: "縮小 PR と負荷スケジュールが重なる",
      citations: [
        {
          id: "sig-pr",
          kind: "FUTURE_CHANGE",
          kindLabel: "未来の変更",
          subject: "db.connection_pool",
          when: "マージ後",
          desc: "pool 縮小 PR",
          url: "https://github.com/x/y/pull/42",
          alertId: undefined,
        },
      ],
    },
    {
      window: "週明け",
      subject: "バッチ遅延",
      level: "LOW",
      confidence: 0.4,
      reasoning: "軽微な遅延の可能性",
      citations: [],
    },
  ],
};

function apiMock(over: Partial<ForecastApi> = {}): ForecastApi {
  return {
    getLatest: vi
      .fn()
      .mockResolvedValue({ kind: "ready", briefing: BRIEFING }),
    generate: vi.fn().mockResolvedValue(BRIEFING),
    ...over,
  };
}

function renderPage(api: ForecastApi) {
  return render(
    <MemoryRouter initialEntries={["/forecast"]}>
      <ForecastProvider api={api}>
        <ForecastPage />
      </ForecastProvider>
    </MemoryRouter>,
  );
}

describe("ForecastPage", () => {
  it("最新予報をリスク一覧（level 降順）とメタ情報つきで出し、Forecast タブが点灯する", async () => {
    renderPage(apiMock());

    expect(await screen.findByText("DB 接続プール枯渇")).toBeInTheDocument();
    expect(screen.getByText("対象: 今週末")).toBeInTheDocument();
    expect(screen.getByText("評価シグナル: 3 件")).toBeInTheDocument();

    // level 降順: HIGH（DB 接続プール枯渇）→ LOW（バッチ遅延）
    const cards = screen.getAllByRole("article");
    expect(cards[0]).toHaveTextContent("DB 接続プール枯渇");
    expect(cards[1]).toHaveTextContent("バッチ遅延");

    // FORECAST_ENABLED 有効時はナビに Forecast タブ＋HIGH バッジ
    expect(screen.getByRole("link", { name: /Forecast/ })).toBeInTheDocument();
    expect(screen.getByText("HIGH 1件")).toBeInTheDocument();
  });

  it("未生成（empty）は案内を出し「予報を生成」で結果を反映する", async () => {
    const api = apiMock({
      getLatest: vi.fn().mockResolvedValue({ kind: "empty" as const }),
    });
    renderPage(api);

    expect(
      await screen.findByText(/予報はまだ生成されていません/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "予報を生成" }));
    expect(await screen.findByText("DB 接続プール枯渇")).toBeInTheDocument();
    expect(api.generate).toHaveBeenCalledTimes(1);
  });

  it("生成が DEMO_ENABLED off（404）ならデモ無効の文言を出す", async () => {
    const api = apiMock({
      getLatest: vi.fn().mockResolvedValue({ kind: "empty" as const }),
      generate: vi
        .fn()
        .mockRejectedValue(new HttpError(404, "Not Found", "Not Found")),
    });
    renderPage(api);

    await userEvent.click(
      await screen.findByRole("button", { name: "予報を生成" }),
    );
    expect(
      await screen.findByText(/デモ操作（予報の生成）が無効/),
    ).toBeInTheDocument();
  });

  it("fallback 予報は失敗バナーを出しリスクは出さない", async () => {
    const snapshot: ForecastSnapshot = {
      kind: "ready",
      briefing: {
        ...BRIEFING,
        isFallback: true,
        risks: [],
        highRiskCount: 0,
      },
    };
    renderPage(apiMock({ getLatest: vi.fn().mockResolvedValue(snapshot) }));

    expect(
      await screen.findByText(/予報の生成に失敗したため/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("FORECAST_ENABLED off（disabled）は無効の案内を出し、ナビにも Forecast を出さない", async () => {
    renderPage(
      apiMock({
        getLatest: vi.fn().mockResolvedValue({ kind: "disabled" as const }),
      }),
    );

    expect(
      await screen.findByText(/予兆ブリーフィングはこの環境では無効です/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Forecast/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /予報を/ }),
    ).not.toBeInTheDocument();
  });

  it("取得失敗はエラー文言と再試行ボタンを出す", async () => {
    const getLatest = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(500, "Internal Server Error", undefined))
      .mockResolvedValueOnce({ kind: "ready", briefing: BRIEFING });
    renderPage(apiMock({ getLatest }));

    expect(
      await screen.findByText(/予報の取得に失敗しました/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() =>
      expect(screen.getByText("DB 接続プール枯渇")).toBeInTheDocument(),
    );
  });
});
