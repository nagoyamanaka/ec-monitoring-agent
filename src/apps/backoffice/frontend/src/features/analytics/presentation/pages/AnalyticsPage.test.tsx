import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    // 各ステージは「役割の平易文」を主役に出す（生の技術文字列を主役にしない）。
    expect(scope.getByText("未知")).toBeInTheDocument();
    expect(scope.getByText("初めて見る障害")).toBeInTheDocument();
    expect(scope.getByText("承認")).toBeInTheDocument();
    expect(scope.getByText("人が原因を確定")).toBeInTheDocument();
    expect(scope.getByText("既知")).toBeInTheDocument();
    expect(scope.getByText("次回から即わかる")).toBeInTheDocument();
    // AI 推定パターンID は日本語ラベルへ人間語化して出す（機械IDを露出させない）。
    expect(scope.getByText("DB接続プールの枯渇")).toBeInTheDocument();
    expect(
      scope.queryByText(/DB_CONNECTION_POOL_EXHAUSTION/),
    ).toBeNull();
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

describe("AnalyticsPage 引用照合率（従属ブロック）", () => {
  const coverage = {
    total: 9,
    resolved: 8,
    byKind: [
      { kind: "terraform", count: 4 },
      { kind: "cve", count: 2 },
    ],
    unmeasured: 0,
  };

  // 集計は主役から降ろした折りたたみの中にある（U5）。開くところまでが表示条件。
  // jsdom は summary クリックで details を開かない（活性化の挙動が未実装）ので、
  // open を立てて toggle を発火する＝ブラウザが行う手順をそのまま再現する。
  async function openAggregate() {
    const summary = await screen.findByText(/集計で確かめる/);
    const details = summary.closest("details") as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
  }

  it("X/Y の件数と種別内訳を出す（％を大書きしない）", async () => {
    renderPage(fakeApi({ citationCoverage: coverage }));
    await openAggregate();

    const line = await screen.findByText(/が実在照合済み/);
    const scope = within(line.parentElement as HTMLElement);
    expect(scope.getByText("8/9")).toBeInTheDocument();
    // kind は機械語のまま出さず、引用チップと同じ日本語ラベルへ写す。
    expect(scope.getByText(/Terraformリソース 4・脆弱性 \(CVE\) 2/)).toBeInTheDocument();
    expect(scope.queryByText(/%/)).toBeNull();
  });

  it("照合結果が未保存の引用があれば除外件数を併記する", async () => {
    renderPage(fakeApi({ citationCoverage: { ...coverage, unmeasured: 3 } }));
    await openAggregate();

    expect(
      await screen.findByText(/照合結果が未保存の引用 3 件は集計から除外/),
    ).toBeInTheDocument();
  });

  it("引用が1件も無ければ行ごと出さない（母数0の率を作らない）", async () => {
    renderPage(fakeApi());
    await openAggregate();
    // 集計ブロック自体は開いている（正答率カードが出ている）。
    await screen.findByText(/フィードバック 2 件を母数に算出/);

    expect(screen.queryByText(/が実在照合済み/)).toBeNull();
  });
});

describe("AnalyticsPage 予報の測定（診断側とは別ブロック・E6）", () => {
  const measurement = {
    forecasts: 4,
    excludedFallback: 0,
    excludedNoSignals: 2,
    excludedUnmeasured: 0,
    citationsEmitted: 11,
    citationsDropped: 0,
    risksEmitted: 6,
    risksDropped: 0,
    signalsCollected: 34,
    signalsByKind: [
      { kind: "FUTURE_CHANGE", count: 12 },
      { kind: "MEMORY", count: 10 },
    ],
    risksSurvived: 6,
    byLevel: [
      { level: "HIGH", count: 1, withMemoryCitation: 1 },
      { level: "MEDIUM", count: 3, withMemoryCitation: 1 },
      { level: "LOW", count: 2, withMemoryCitation: 0 },
    ],
  };

  async function openAggregate() {
    const summary = await screen.findByText(/集計で確かめる/);
    const details = summary.closest("details") as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
  }

  it("破棄が0でも件数で出す（発火していないことを隠さない・率にしない）", async () => {
    renderPage(fakeApi({ forecastMeasurement: measurement }));
    await openAggregate();

    const line = await screen.findByText(/実在しない引用として破棄/);
    const scope = within(line as HTMLElement);
    expect(scope.getByText("11")).toBeInTheDocument();
    expect(scope.getAllByText("0").length).toBeGreaterThan(0);
    // 数字の行に％を作らない。％が出てよいのは「残った側は定義上 100%」という
    // 率を出さない理由の説明だけで、それは別の行（注記）にある。
    expect(scope.queryByText(/%/)).toBeNull();
    expect(
      await screen.findByText(/残った引用の照合率は定義上 100%/),
    ).toBeInTheDocument();
  });

  it("収集 → 発火の絞り込みを kind 別内訳つきで出す", async () => {
    renderPage(fakeApi({ forecastMeasurement: measurement }));
    await openAggregate();

    const line = await screen.findByText(/件を突合して/);
    const scope = within(line as HTMLElement);
    expect(scope.getByText("34")).toBeInTheDocument();
    expect(scope.getByText("6")).toBeInTheDocument();
    // kind は機械語（FUTURE_CHANGE）のまま出さない
    expect(scope.getByText(/未来の変更 12・過去インシデント 10/)).toBeInTheDocument();
  });

  it("level 分布を「うち前例あり」つきで出す（前例が無くても出る・ただし弱く出る）", async () => {
    renderPage(fakeApi({ forecastMeasurement: measurement }));
    await openAggregate();

    expect(
      await screen.findByText(
        /高 1（うち前例あり 1）・中 3（うち前例あり 1）・低 2（うち前例あり 0）/,
      ),
    ).toBeInTheDocument();
  });

  it("除外した予報の件数を併記する（LLM を呼んでいない回を黙って混ぜない）", async () => {
    renderPage(fakeApi({ forecastMeasurement: measurement }));
    await openAggregate();

    expect(
      await screen.findByText(/集計から除外: シグナル0件の空予報 2 件/),
    ).toBeInTheDocument();
  });

  it("予報が0回なら行ごと出さない", async () => {
    renderPage(fakeApi());
    await openAggregate();
    await screen.findByText(/フィードバック 2 件を母数に算出/);

    expect(screen.queryByText(/実在しない引用として破棄/)).toBeNull();
  });
});
