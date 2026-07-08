import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

  it("根拠の種類数チップ: 複数種類なら「根拠 n種類」、単一種類なら出さない", () => {
    renderCard();
    expect(screen.getByText("根拠 2種類")).toBeInTheDocument();

    renderCard({ ...RISK, citations: [RISK.citations[0]] });
    expect(screen.queryByText(/根拠 1種類/)).not.toBeInTheDocument();
  });

  it("引用チップを種類・件数付きで出し、外部証拠（PR）とアラート詳細の両リンクを張る", () => {
    renderCard();
    // レーンラベルは収束ミニフローと引用の両方に出るため、引用セクションに絞って検証する
    const citations = within(screen.getByRole("region", { name: "引用" }));
    expect(citations.getByText("根拠（引用）")).toBeInTheDocument();
    expect(citations.getByText("2種類・2件")).toBeInTheDocument();
    expect(citations.getByText("未来の変更")).toBeInTheDocument();
    expect(citations.getByText("過去の同型事例")).toBeInTheDocument();
    // A3: 見出しは人間語の desc、メタ行は「シグナルID · 生subject」の font-mono（<details> 内に格納）
    //（ID は reasoning 本文・コンソール台帳と同一語彙＝三点照合できる）
    const desc = citations.getByText("pool 100→40 に縮小する未マージ PR");
    expect(desc).toHaveClass("font-medium");
    const prMeta = citations.getByText("sig-pr · db.connection_pool");
    const memMeta = citations.getByText("sig-mem · db.connection_pool");
    [prMeta, memMeta].forEach((el) => expect(el).toHaveClass("font-mono"));

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

  it("収束ミニフロー（入力→AI 調査→結論）を引用の上に描画する", () => {
    renderCard();
    expect(
      screen.getByRole("region", { name: "収束のミニフロー" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI 調査")).toBeInTheDocument();
  });

  it("先手の効果1行: past 件数>0 のとき先手ブロック内に決定論テンプレを併記する", () => {
    renderCard({
      ...RISK,
      preventiveAction: "PR のマージをセール後へ延期する。",
    });
    expect(
      screen.getByText(
        "この先手で、過去の同型事例（1件）と同じ経路の再発を高負荷窓の外へ外します。",
      ),
    ).toBeInTheDocument();
  });

  it("past 引用が無ければ効果行は出さない（盛らない側）", () => {
    renderCard({
      ...RISK,
      preventiveAction: "PR のマージをセール後へ延期する。",
      citations: [RISK.citations[0]], // FUTURE_CHANGE のみ＝MEMORY 0件
    });
    expect(screen.queryByText(/同じ経路の再発を高負荷窓の外へ外します/)).not.toBeInTheDocument();
  });
});
