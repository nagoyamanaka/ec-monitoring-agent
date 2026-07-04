import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastDemoConsole } from "./ForecastDemoConsole";

function renderConsole(
  over: Partial<Parameters<typeof ForecastDemoConsole>[0]> = {},
) {
  const props = {
    hasBriefing: false,
    generating: false,
    resetting: false,
    actionError: null,
    onGenerate: vi.fn(),
    onReset: vi.fn(),
    ...over,
  };
  render(<ForecastDemoConsole {...props} />);
  return props;
}

describe("ForecastDemoConsole", () => {
  it("投入シグナルの台帳を本物度バッジ（実データ/合成seed）つきで出す", () => {
    renderConsole();
    expect(screen.getByText("投入シグナル（予報の材料）")).toBeInTheDocument();
    expect(screen.getByText("未適用の Terraform plan")).toBeInTheDocument();
    expect(screen.getByText("未マージ PR")).toBeInTheDocument();
    expect(screen.getByText("負荷スケジュール")).toBeInTheDocument();
    expect(screen.getByText("過去の解決済み事例")).toBeInTheDocument();
    // 正直さ: 実 GitHub PR だけが実データ・残り3つは合成 seed
    expect(screen.getAllByText("実データ")).toHaveLength(1);
    expect(screen.getAllByText("合成seed")).toHaveLength(3);
  });

  it("生成/リセットのボタンがコールバックを呼ぶ（文言は未生成/生成済みで切替）", async () => {
    const props = renderConsole();
    await userEvent.click(
      screen.getByRole("button", { name: "▶ 予報を生成（AI 突合・約1分）" }),
    );
    expect(props.onGenerate).toHaveBeenCalledTimes(1);

    await userEvent.click(
      screen.getByRole("button", { name: "予報をリセット" }),
    );
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it("生成済みなら「再生成」表記になり、生成中は両ボタンとも押せない", () => {
    renderConsole({ hasBriefing: true, generating: true });
    expect(
      screen.getByRole("button", { name: "AI が突合中…（約1分）" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "予報をリセット" }),
    ).toBeDisabled();
  });

  it("操作エラーを alert として出す", () => {
    renderConsole({ actionError: "予報のリセットに失敗しました。" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "予報のリセットに失敗しました。",
    );
  });
});
