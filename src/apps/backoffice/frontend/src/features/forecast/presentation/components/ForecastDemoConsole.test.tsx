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
  it("投入シグナルの台帳を、引用レーンと同じ3種類＋本物度バッジで出す", () => {
    renderConsole();
    expect(screen.getByText("投入シグナル（予報の材料）")).toBeInTheDocument();
    // 材料の分類＝引用レーンと同一の3種類（同じラベル・役割の一言つき）
    expect(screen.getByText("未来の変更")).toBeInTheDocument();
    expect(screen.getByText("何が変わる予定か")).toBeInTheDocument();
    expect(screen.getByText("スケジュール")).toBeInTheDocument();
    expect(screen.getByText("いつ負荷が来るか")).toBeInTheDocument();
    expect(screen.getByText("過去の同型事例")).toBeInTheDocument();
    expect(screen.getByText("過去に何が起きたか")).toBeInTheDocument();
    // 種類の中に材料行が並ぶ（U2: 未来の変更に Valkey plan 行が加わり計2 plan＋PR）
    expect(
      screen.getByText("未適用の Terraform plan（VM 縮小）"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("未適用の Terraform plan（Valkey 縮小）"),
    ).toBeInTheDocument();
    expect(screen.getByText("未マージ PR")).toBeInTheDocument();
    expect(screen.getByText("負荷スケジュール")).toBeInTheDocument();
    expect(screen.getByText("過去の解決済み事例")).toBeInTheDocument();
    // 正直さ: 実データ（open PR）＋実plan（実 PR #83 の CI plan を固定投入）は実在。
    // Valkey plan・スケジュール・過去事例の3つが合成 seed（Valkey plan は実 PR を持たない）。
    // open PR は全件 read＝台帳に無い PR が予報に現れても嘘にならない文言。
    expect(screen.getAllByText("実データ")).toHaveLength(1);
    expect(screen.getAllByText("実plan")).toHaveLength(1);
    expect(screen.getAllByText("合成seed")).toHaveLength(3);
    expect(screen.getByText(/open PR を全件 read/)).toBeInTheDocument();
  });

  it("生成/リセットのボタンがコールバックを呼ぶ（文言は未生成/生成済みで切替）", async () => {
    const props = renderConsole();
    await userEvent.click(
      screen.getByRole("button", { name: "▶ 予報を生成（AI 調査・約1分）" }),
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
      screen.getByRole("button", { name: "AI が調査中…（約1分）" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "予報をリセット" }),
    ).toBeDisabled();
    // 視線誘導: 進行状況と着地は本文側であることを指し示す
    expect(
      screen.getByText(/進行状況は予報本文の側に表示しています/),
    ).toBeInTheDocument();
  });

  it("操作エラーを alert として出す", () => {
    renderConsole({ actionError: "予報のリセットに失敗しました。" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "予報のリセットに失敗しました。",
    );
  });
});
