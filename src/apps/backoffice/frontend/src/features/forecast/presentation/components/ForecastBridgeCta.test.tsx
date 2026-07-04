import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ForecastBridgeCta } from "./ForecastBridgeCta";

describe("ForecastBridgeCta", () => {
  it("保険トーンの見出し＋/alerts への純ナビゲーションリンクを出す（ボタンは無い）", () => {
    render(
      <MemoryRouter>
        <ForecastBridgeCta />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("もし防ぎきれずに発火したら？"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /アラート一覧を見る/ }),
    ).toHaveAttribute("href", "/alerts");
    // write-zero: 実行ボタンの視覚語彙を持ち込まない＝button ロールは存在しない
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
