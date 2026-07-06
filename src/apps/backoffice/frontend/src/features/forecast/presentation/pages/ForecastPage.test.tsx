import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HttpError } from "@shared/api/HttpClient";
import type { DemoApi } from "@features/demo/infrastructure/demoApi";
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
      preventiveAction: "縮小 PR のマージをセール後へ延期する。",
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
    reset: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

/** デモ有効（/demo/status 200）を既定にする。404 でコンソールが伏せられる経路は個別テストで上書き。 */
function demoApiMock(over: Partial<DemoApi> = {}): DemoApi {
  return {
    getStatus: vi.fn().mockResolvedValue({
      demoEnabled: true,
      totalAlerts: 0,
      activeAlerts: 0,
      promotedPatternCount: 0,
      patternCount: 0,
    }),
    triggerScenario: vi.fn(),
    reset: vi.fn(),
    ...over,
  };
}

function renderPage(api: ForecastApi, demoApi: DemoApi = demoApiMock()) {
  return render(
    <MemoryRouter initialEntries={["/forecast"]}>
      <ForecastProvider api={api}>
        <ForecastPage demoApi={demoApi} />
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

    // F11a: 先手（防ぐ）がカード内に出る＝ページの主役
    expect(screen.getByText("今打てる先手")).toBeInTheDocument();
    expect(
      screen.getByText("縮小 PR のマージをセール後へ延期する。"),
    ).toBeInTheDocument();

    // F10-②/F11b: risks がある時はリスク一覧の末尾に橋渡しCTA（保険・ページ単位で1個）
    expect(
      screen.getByText("もし防ぎきれずに発火したら？"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /アラート一覧を見る/ }),
    ).toHaveAttribute("href", "/alerts");

    // F12: デモ有効ならデモコンソール（投入シグナル台帳＋操作）が右に出る
    expect(
      screen.getByRole("region", { name: "予兆デモコンソール" }),
    ).toBeInTheDocument();
    expect(screen.getByText("投入シグナル（予報の材料）")).toBeInTheDocument();
  });

  it("未生成（empty）はコンソールへの案内を出し「予報を生成」で結果を反映する", async () => {
    const api = apiMock({
      getLatest: vi.fn().mockResolvedValue({ kind: "empty" as const }),
    });
    renderPage(api);

    expect(
      await screen.findByText(/予報はまだ生成されていません/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/右のデモコンソールから「予報を生成」/),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "▶ 予報を生成（AI 突合・約1分）" }),
    );
    expect(await screen.findByText("DB 接続プール枯渇")).toBeInTheDocument();
    expect(api.generate).toHaveBeenCalledTimes(1);
  });

  it("生成中は進行バナーを本文側に出し、empty 案内を伏せ、完了で予報カードへ置き換える", async () => {
    let resolveGenerate!: (b: ForecastBriefingView) => void;
    const api = apiMock({
      getLatest: vi.fn().mockResolvedValue({ kind: "empty" as const }),
      generate: vi.fn().mockImplementation(
        () =>
          new Promise<ForecastBriefingView>((resolve) => {
            resolveGenerate = resolve;
          }),
      ),
    });
    renderPage(api);

    await userEvent.click(
      await screen.findByRole("button", {
        name: "▶ 予報を生成（AI 突合・約1分）",
      }),
    );

    // 進行バナー（経過タイマー・処理ステップ・引用検証の説明）が本文側に出る
    expect(screen.getByText("AI が突合中…")).toBeInTheDocument();
    expect(screen.getByText("引用検証（実在照合）")).toBeInTheDocument();
    // 「生成してください」の empty 案内は生成中は矛盾するので伏せる
    expect(
      screen.queryByText(/予報はまだ生成されていません/),
    ).not.toBeInTheDocument();
    // コンソール側にも視線誘導の1行
    expect(
      screen.getByText(/進行状況は予報本文の側に表示しています/),
    ).toBeInTheDocument();

    resolveGenerate(BRIEFING);
    expect(await screen.findByText("DB 接続プール枯渇")).toBeInTheDocument();
    expect(screen.queryByText("AI が突合中…")).not.toBeInTheDocument();
  });

  it("再生成中は前回の予報を暗転ラベルつきで残し、完了で置き換える", async () => {
    let resolveGenerate!: (b: ForecastBriefingView) => void;
    const api = apiMock({
      generate: vi.fn().mockImplementation(
        () =>
          new Promise<ForecastBriefingView>((resolve) => {
            resolveGenerate = resolve;
          }),
      ),
    });
    renderPage(api);
    expect(await screen.findByText("DB 接続プール枯渇")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "▶ 予報を再生成（AI 突合・約1分）" }),
    );

    // 前回分は空白にせず暗転して残す（新旧の取り違え防止ラベルつき）
    expect(
      screen.getByText("前回の予報（再生成が完成すると置き換わります）"),
    ).toBeInTheDocument();
    expect(screen.getByText("DB 接続プール枯渇")).toBeInTheDocument();
    // バナーは再生成向けの着地先文言
    expect(
      screen.getByText(/下の予報カードが新しい内容に置き換わります/),
    ).toBeInTheDocument();

    resolveGenerate(BRIEFING);
    await waitFor(() =>
      expect(
        screen.queryByText("前回の予報（再生成が完成すると置き換わります）"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("DB 接続プール枯渇")).toBeInTheDocument();
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
      await screen.findByRole("button", {
        name: "▶ 予報を生成（AI 突合・約1分）",
      }),
    );
    expect(
      await screen.findByText(/デモ操作（予報の生成）が無効/),
    ).toBeInTheDocument();
  });

  it("「予報をリセット」で DELETE を呼び未生成状態へ戻す（F12）", async () => {
    const api = apiMock();
    renderPage(api);
    expect(await screen.findByText("DB 接続プール枯渇")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "予報をリセット" }),
    );

    expect(api.reset).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/予報はまだ生成されていません/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("DEMO 無効（/demo/status 404）ならデモコンソールを出さない（予報は見える）", async () => {
    renderPage(
      apiMock(),
      demoApiMock({
        getStatus: vi
          .fn()
          .mockRejectedValue(new HttpError(404, "Not Found", "Not Found")),
      }),
    );

    expect(await screen.findByText("DB 接続プール枯渇")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "予兆デモコンソール" }),
      ).not.toBeInTheDocument(),
    );
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
    // 失敗バナーの下に橋渡しCTAは出さない（risks 空＝リンク先の物語が無い）
    expect(
      screen.queryByText("もし防ぎきれずに発火したら？"),
    ).not.toBeInTheDocument();
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
