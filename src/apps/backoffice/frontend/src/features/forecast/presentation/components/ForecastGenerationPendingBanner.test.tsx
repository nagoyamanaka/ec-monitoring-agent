import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ForecastGenerationPendingBanner } from "./ForecastGenerationPendingBanner";

describe("ForecastGenerationPendingBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("経過タイマー・処理ステップ・引用検証の説明を出す（初回生成）", () => {
    render(<ForecastGenerationPendingBanner regenerating={false} />);

    expect(screen.getByRole("status")).toHaveTextContent("AI が突合中…");
    expect(screen.getByText("経過 0 秒 ・ 通常 約1分")).toBeInTheDocument();

    // 通過中の実ステップ（完了は偽点灯しない＝チップ表示のみ）
    for (const step of [
      "シグナル収集",
      "AI 突合（Gemini）",
      "引用検証（実在照合）",
      "予報カード",
    ]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }

    // 待ち時間を売りの説明に転化: 偽引用を落とす機構＋結果の着地先
    expect(
      screen.getByText(/実在しないものは落とします/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/完成するとここに予報カードが表示されます/),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("経過 3 秒 ・ 通常 約1分")).toBeInTheDocument();
  });

  it("再生成時は着地先の文言が「下の予報カードが置き換わる」になる", () => {
    render(<ForecastGenerationPendingBanner regenerating />);
    expect(
      screen.getByText(/下の予報カードが新しい内容に置き換わります/),
    ).toBeInTheDocument();
  });

  it("60秒超過で打ち切り（90秒 timeout）予告のヒントを出す", () => {
    render(<ForecastGenerationPendingBanner regenerating={false} />);
    expect(
      screen.queryByText(/想定より時間がかかっています/),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(
      screen.getByText(/想定より時間がかかっています/),
    ).toBeInTheDocument();
    expect(screen.getByText(/90 秒を超えた場合は打ち切り/)).toBeInTheDocument();
  });
});
