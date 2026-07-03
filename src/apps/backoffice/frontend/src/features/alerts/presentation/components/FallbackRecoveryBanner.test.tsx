import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FallbackRecoveryBanner,
  FALLBACK_REINVESTIGATE_NOTE,
} from "./FallbackRecoveryBanner";
import { makeAlert, makeReport } from "../../test-support/alertFixture";

const fallbackAlert = () =>
  makeAlert({
    id: "a-fb",
    report: makeReport({ isFallback: true, suggestedPatternName: "" }),
  });

describe("FallbackRecoveryBanner", () => {
  it("警告文言と「再調査を実行」ボタンを出し、定型の指摘文で onReinvestigate を呼ぶ", async () => {
    const onReinvestigate = vi.fn().mockResolvedValue(undefined);
    render(
      <FallbackRecoveryBanner
        alert={fallbackAlert()}
        onReinvestigate={onReinvestigate}
      />,
    );

    expect(screen.getByText("AI 調査に失敗・暫定表示")).toBeInTheDocument();
    expect(
      screen.getByText(/確信度は参考値です（再調査をおすすめします）/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /再調査を実行/ }));
    expect(onReinvestigate).toHaveBeenCalledWith(
      "a-fb",
      FALLBACK_REINVESTIGATE_NOTE,
    );
  });

  it("onReinvestigate 未注入なら警告バナーのみ（ボタンなし）", () => {
    render(<FallbackRecoveryBanner alert={fallbackAlert()} />);
    expect(screen.getByText("AI 調査に失敗・暫定表示")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /再調査を実行/ }),
    ).not.toBeInTheDocument();
  });

  it("送信中はボタンを無効化し「再調査を依頼中…」を表示する", async () => {
    let resolve!: () => void;
    const onReinvestigate = vi.fn().mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(
      <FallbackRecoveryBanner
        alert={fallbackAlert()}
        onReinvestigate={onReinvestigate}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /再調査を実行/ }));
    expect(
      screen.getByRole("button", { name: "再調査を依頼中…" }),
    ).toBeDisabled();

    // 完了後はボタンが元に戻る（act 警告を出さないよう解決まで待つ）。
    resolve();
    expect(
      await screen.findByRole("button", { name: /再調査を実行/ }),
    ).toBeEnabled();
  });
});
