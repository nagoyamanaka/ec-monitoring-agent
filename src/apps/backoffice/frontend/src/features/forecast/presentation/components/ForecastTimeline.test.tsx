import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CitationView, RiskCardView } from "../../domain/ForecastView";
import { ForecastTimeline } from "./ForecastTimeline";

const SCHEDULE: CitationView = {
  id: "sch-1",
  kind: "SCHEDULE",
  kindLabel: "スケジュール",
  subject: "checkout",
  when: "土 20:00-23:00",
  desc: "checkout 負荷 x5（週末セール）",
};

const RISK: RiskCardView = {
  window: "土 20:00-23:00",
  subject: "db_connection_pool",
  level: "HIGH",
  confidence: 0.9,
  reasoning: "…",
  citations: [SCHEDULE],
};

// JST 2026-08-04(火) 15:13 発行 → 発生 08-08(土) 20:00
const generatedAt = "2026-08-04T06:13:51.238Z";

describe("ForecastTimeline", () => {
  it("画面に無かった「対処を始める期限」を出す", () => {
    render(<ForecastTimeline risk={RISK} generatedAt={generatedAt} />);

    expect(screen.getByText(/対処を始める期限/)).toBeInTheDocument();
    expect(screen.getByText(/8\/8.*19:30/)).toBeInTheDocument();
  });

  it("判断に使える時間（E6-2）を出す", () => {
    render(<ForecastTimeline risk={RISK} generatedAt={generatedAt} />);

    expect(screen.getByText("判断に使える時間 100時間16分")).toBeInTheDocument();
  });

  it("対処の所要は宣言値であることを添える（実測と読ませない）", () => {
    render(<ForecastTimeline risk={RISK} generatedAt={generatedAt} />);

    expect(screen.getByText(/対処の所要 30分（宣言値）/)).toBeInTheDocument();
  });

  it("予測発生時刻の出所を書く（それっぽい絵にしない）", () => {
    render(<ForecastTimeline risk={RISK} generatedAt={generatedAt} />);

    expect(
      screen.getByText(/引用したスケジュール「土 20:00-23:00」から解決/),
    ).toBeInTheDocument();
    expect(screen.getByText(/推論値ではありません/)).toBeInTheDocument();
  });

  it("軸の意味は読み上げでも取れる（色と長さだけに載せない）", () => {
    render(<ForecastTimeline risk={RISK} generatedAt={generatedAt} />);

    expect(
      screen.getByRole("img", { name: /対処を始める期限は.*判断に使える時間は 100時間16分/ }),
    ).toBeInTheDocument();
  });

  it("間に合わない予報は不足分を出す（負を隠さない）", () => {
    render(<ForecastTimeline risk={RISK} generatedAt="2026-08-08T10:50:00.000Z" />);

    expect(
      screen.getByText("対処が間に合わない見込み（20分の不足）"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/判断に使える時間/)).not.toBeInTheDocument();
  });

  it("スケジュールを引用していないリスクでは軸ごと出さない（縮退）", () => {
    const { container } = render(
      <ForecastTimeline risk={{ ...RISK, citations: [] }} generatedAt={generatedAt} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
