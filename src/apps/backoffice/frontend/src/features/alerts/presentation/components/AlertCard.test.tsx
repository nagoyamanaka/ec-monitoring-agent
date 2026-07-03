import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCard } from "./AlertCard";
import { makeAlert } from "../../test-support/alertFixture";

describe("AlertCard", () => {
  it("カタログ未登録の eventName は主役にそのまま出す（フォールバック）", () => {
    render(<AlertCard alert={makeAlert()} />);
    expect(screen.getByText("latency.spike")).toBeInTheDocument();
    // 未知（report あり）は AI 推定パターン名を出す（summary ではなく patternName）
    expect(screen.getByText(/AI推定/)).toBeInTheDocument();
    expect(screen.getByText(/latency-spike/)).toBeInTheDocument();
  });

  it("カタログ登録済みの eventName は人間語タイトルを主役に出す", () => {
    render(<AlertCard alert={makeAlert({ eventName: "ec.payment.timeout" })} />);
    expect(screen.getByText("決済タイムアウト")).toBeInTheDocument();
  });

  it("category は人間語ラベルに変換して出す", () => {
    render(<AlertCard alert={makeAlert({ category: "APPLICATION" })} />);
    expect(screen.getByText("アプリ層")).toBeInTheDocument();
    expect(screen.queryByText("APPLICATION")).not.toBeInTheDocument();
  });

  it("重要度はバッジで出さない（左ストライプ色＋sr-onlyのみ・バッジ軸分離）", () => {
    render(<AlertCard alert={makeAlert({ severity: "CRITICAL" })} />);
    // 視覚バッジは無し（SeverityBadge のラベル「重大」チップを出さない）が、
    // スクリーンリーダー向けの読み上げテキストは残す。
    expect(screen.getByText(/重要度 重大/)).toHaveClass("sr-only");
  });

  it("分析中は重要度を判定中と読み上げる（sr-only）", () => {
    render(
      <AlertCard alert={makeAlert({ status: "ANALYZING", report: null })} />,
    );
    expect(screen.getByText(/重要度 判定中/)).toHaveClass("sr-only");
  });

  it("クリックで onSelect を alert id 付きで呼ぶ", async () => {
    const onSelect = vi.fn();
    render(<AlertCard alert={makeAlert({ id: "a-9" })} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("a-9");
  });

  it("選択中は aria-pressed が立つ", () => {
    render(<AlertCard alert={makeAlert()} selected />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("分析中の alert はインジケータと算出中表示を出す", () => {
    render(
      <AlertCard alert={makeAlert({ status: "ANALYZING", report: null })} />,
    );
    expect(screen.getByText("分析中")).toBeInTheDocument();
    expect(screen.getByText(/算出中/)).toBeInTheDocument();
  });

  it("確信度がある alert は % を表示する", () => {
    render(<AlertCard alert={makeAlert()} />);
    // makeReport の confidence 0.82 → 82%
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("未知障害バッジは出さない（分類根拠は「AI推定:」行と確信度チップに一本化・バッジ軸分離）", () => {
    render(
      <AlertCard
        alert={makeAlert({ classification: { type: "unknown", confidence: null } })}
      />,
    );
    expect(screen.queryByText("未知障害")).not.toBeInTheDocument();
    expect(screen.getByText(/AI推定/)).toBeInTheDocument();
  });

  it("いま着弾した新規アラート（createdAt が直近）はスライドイン演出を付ける（E5）", () => {
    render(<AlertCard alert={makeAlert({ createdAt: new Date().toISOString() })} />);
    expect(screen.getByTestId("alert-card")).toHaveClass("card-arrive");
  });

  it("過去のアラート（初回ロードで並ぶ分）は着弾演出を付けない（E5）", () => {
    render(<AlertCard alert={makeAlert()} />);
    expect(screen.getByTestId("alert-card")).not.toHaveClass("card-arrive");
  });

  it("SSE 更新（updatedAt 変化）でその場グローを付ける＝新規と区別（E5）", () => {
    const { rerender } = render(<AlertCard alert={makeAlert()} />);
    rerender(
      <AlertCard alert={makeAlert({ updatedAt: "2026-06-21T00:00:05.000Z" })} />,
    );
    const card = screen.getByTestId("alert-card");
    expect(card).toHaveClass("card-update-flash");
    expect(card).not.toHaveClass("card-arrive");
  });

  it("dedup 加算（occurrenceCount 増加）で重複カウンタがパルスする（E5）", () => {
    const { rerender } = render(
      <AlertCard alert={makeAlert({ occurrenceCount: 2 })} />,
    );
    expect(screen.getByText(/重複/)).not.toHaveClass("count-pulse");
    rerender(
      <AlertCard
        alert={makeAlert({
          occurrenceCount: 3,
          updatedAt: "2026-06-21T00:00:05.000Z",
        })}
      />,
    );
    expect(screen.getByText(/重複/)).toHaveClass("count-pulse");
    expect(screen.getByText(/重複 3件/)).toBeInTheDocument();
  });

  it("昇格（結晶化）パターンは生IDを出さず ◈＋人間語で出す（生IDは tooltip）", () => {
    render(
      <AlertCard
        alert={makeAlert({
          eventName: "ec.payment.timeout",
          report: null,
          classification: {
            type: "known",
            source: "EXACT_MATCH",
            patternId: "p-1",
            patternName: "PROMOTED_EC.PAYMENT.TIMEOUT",
            confidence: 1,
            matchedConditions: [],
          },
        })}
      />,
    );
    expect(screen.queryByText(/PROMOTED_/)).not.toBeInTheDocument();
    expect(screen.getByTitle(/PROMOTED_EC\.PAYMENT\.TIMEOUT/)).toHaveTextContent(
      "決済タイムアウト",
    );
  });
});
