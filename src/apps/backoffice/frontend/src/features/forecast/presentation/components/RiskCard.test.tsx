import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { RiskCardView } from "../../domain/ForecastView";
import { RiskCard } from "./RiskCard";

const RISK: RiskCardView = {
  window: "土曜 20:00-22:00",
  subject: "DB 接続プール枯渇",
  level: "HIGH",
  confidence: 0.8,
  reasoning: "接続上限を縮小する未マージ PR と週末の負荷スケジュールが重なる",
  citations: [
    {
      id: "sig-pr",
      kind: "FUTURE_CHANGE",
      kindLabel: "未来の変更",
      subject: "db.connection_pool",
      when: "マージ後",
      desc: "pool 100→40 に縮小する未マージ PR",
      url: "https://github.com/x/y/pull/42",
      alertId: undefined,
    },
    {
      id: "sig-mem",
      kind: "MEMORY",
      kindLabel: "過去の同型事例",
      subject: "db.connection_pool",
      when: "2026-05",
      desc: "同型の接続枯渇を解決済み",
      url: undefined,
      alertId: "alert-123",
    },
  ],
};

function renderCard(risk: RiskCardView = RISK) {
  return render(
    <MemoryRouter>
      <RiskCard risk={risk} />
    </MemoryRouter>,
  );
}

describe("RiskCard", () => {
  it("window を主見出しに、level バッジ・confidence%・reasoning を出す", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { level: 3, name: /土曜 20:00-22:00/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "接続上限を縮小する未マージ PR と週末の負荷スケジュールが重なる",
      ),
    ).toBeInTheDocument();
  });

  it("根拠の系統数チップ: 複数系統なら「根拠 n系統」、単一系統なら出さない", () => {
    renderCard();
    expect(screen.getByText("根拠 2系統")).toBeInTheDocument();

    renderCard({ ...RISK, citations: [RISK.citations[0]] });
    expect(screen.queryByText(/根拠 1系統/)).not.toBeInTheDocument();
  });

  it("引用チップを系統・件数付きで出し、外部証拠（PR）とアラート詳細の両リンクを張る", () => {
    renderCard();
    expect(screen.getByText("根拠（引用）")).toBeInTheDocument();
    expect(screen.getByText("2系統・2件")).toBeInTheDocument();
    expect(screen.getByText("未来の変更")).toBeInTheDocument();
    expect(screen.getByText("過去の同型事例")).toBeInTheDocument();
    // A3: 見出しは人間語の desc、生ID subject は font-mono の従属メタ行へ降格
    const desc = screen.getByText("pool 100→40 に縮小する未マージ PR");
    expect(desc).toHaveClass("font-medium");
    const rawSubjects = screen.getAllByText("db.connection_pool");
    expect(rawSubjects).toHaveLength(2);
    rawSubjects.forEach((el) => expect(el).toHaveClass("font-mono"));

    const external = screen.getByRole("link", { name: /証拠を開く/ });
    expect(external).toHaveAttribute("href", "https://github.com/x/y/pull/42");
    expect(external).toHaveAttribute("target", "_blank");

    const alertLink = screen.getByRole("link", {
      name: /当時のアラートを開く/,
    });
    expect(alertLink).toHaveAttribute("href", "/alerts/alert-123");
  });

  it("引用が空なら引用セクションを描画しない（backend が裏付けゼロを破棄済みの防御）", () => {
    renderCard({ ...RISK, citations: [] });
    expect(screen.queryByText("根拠（引用）")).not.toBeInTheDocument();
  });

  it("先手（F11a）があれば「今打てる先手」ブロックを出す（実行ボタンにはしない）", () => {
    renderCard({
      ...RISK,
      preventiveAction: "接続上限を縮小する plan の適用をセール後へ延期する。",
    });
    expect(screen.getByText("今打てる先手")).toBeInTheDocument();
    expect(
      screen.getByText("接続上限を縮小する plan の適用をセール後へ延期する。"),
    ).toBeInTheDocument();
    // write-zero: 先手は助言テキストのみ＝実行ボタンを持ち込まない
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("先手が無ければ先手ブロックごと出さない（優雅な縮退）", () => {
    renderCard();
    expect(screen.queryByText("今打てる先手")).not.toBeInTheDocument();
  });
});
