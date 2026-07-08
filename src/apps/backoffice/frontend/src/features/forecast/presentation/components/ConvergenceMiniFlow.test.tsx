import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CitationView, RiskCardView } from "../../domain/ForecastView";
import { ConvergenceMiniFlow } from "./ConvergenceMiniFlow";

const citation = (over: Partial<CitationView> = {}): CitationView => ({
  id: "c-1",
  kind: "FUTURE_CHANGE",
  kindLabel: "未来の変更",
  subject: "db.connection_pool",
  when: "マージ後",
  desc: "pool 縮小",
  ...over,
});

const RISK: RiskCardView = {
  window: "土曜 20:00-22:00",
  subject: "DB 接続プール枯渇",
  level: "HIGH",
  confidence: 0.8,
  reasoning: "接続上限縮小と負荷スケジュールが重なる",
  citations: [
    citation({ id: "f-1" }),
    citation({ id: "f-2" }),
    citation({ id: "s-1", kind: "SCHEDULE", kindLabel: "スケジュール" }),
    citation({ id: "m-1", kind: "MEMORY", kindLabel: "過去の同型事例" }),
  ],
};

describe("ConvergenceMiniFlow", () => {
  it("入力レーンを種類別件数で、突合ノードと結論（subject・レベル・確信度%）を出す", () => {
    render(<ConvergenceMiniFlow risk={RISK} />);
    // 入力: 変更予定2件・負荷予定1件・過去1件
    expect(screen.getByText("未来の変更")).toBeInTheDocument();
    expect(screen.getByText("2件")).toBeInTheDocument();
    expect(screen.getByText("スケジュール")).toBeInTheDocument();
    // 調査ノード（アラート詳細の証拠フローと同一語彙）
    expect(screen.getByText("AI 調査")).toBeInTheDocument();
    // 結論（レベルは人間語ラベル・確信度%。subject はカード見出しが担うため非重複）
    expect(screen.getByText("結論に収束")).toBeInTheDocument();
    expect(screen.getByText("高リスク")).toBeInTheDocument();
    expect(screen.getByText("確信度 80%")).toBeInTheDocument();
  });

  it("読み上げ用に収束を1文で要約する（種類・件数・レベル・確信度）", () => {
    render(<ConvergenceMiniFlow risk={RISK} />);
    expect(
      screen.getByText(
        "未来の変更2件・スケジュール1件・過去の同型事例1件を AI が突合し 高リスク（確信度80%）と判定",
      ),
    ).toBeInTheDocument();
  });

  it("引用が無ければ何も描画しない（裏付けゼロは backend が破棄済みの防御）", () => {
    const { container } = render(
      <ConvergenceMiniFlow risk={{ ...RISK, citations: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
