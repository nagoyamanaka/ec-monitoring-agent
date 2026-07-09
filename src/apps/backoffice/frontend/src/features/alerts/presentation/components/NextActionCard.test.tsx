import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextActionCard } from "./NextActionCard";

describe("NextActionCard", () => {
  it("remediation origin は手順リストを出し、remediable ならバッジを添える（footnote は出さない）", () => {
    render(
      <NextActionCard
        next={{
          origin: "remediation",
          steps: [{ text: "max_connections を戻す" }, { text: "接続数を監視" }],
          remediable: true,
        }}
      />,
    );
    expect(screen.getByText("次のアクション")).toBeInTheDocument();
    expect(screen.getByText("max_connections を戻す")).toBeInTheDocument();
    expect(screen.getByText("接続数を監視")).toBeInTheDocument();
    expect(screen.getByText(/コードで修正可能/)).toBeInTheDocument();
    // 実行導線は下の「自動修正」パネルが担うので footnote での案内はしない。
    expect(screen.queryByText(/自動修正/)).not.toBeInTheDocument();
  });

  it("remediation で remediable=false は「コードで修正可能」を出さない", () => {
    render(
      <NextActionCard
        next={{
          origin: "remediation",
          steps: [{ text: "運用手順で復旧" }],
          remediable: false,
        }}
      />,
    );
    expect(screen.queryByText(/コードで修正可能/)).not.toBeInTheDocument();
    expect(screen.getByText("自社で対応")).toBeInTheDocument();
  });

  it("escalation origin は一次対応バッジと引き継ぎ補足を出す", () => {
    render(
      <NextActionCard
        next={{ origin: "escalation", text: "リトライ間隔を延ばす" }}
      />,
    );
    expect(screen.getByText("次のアクション")).toBeInTheDocument();
    expect(screen.getByText("リトライ間隔を延ばす")).toBeInTheDocument();
    expect(screen.getByText(/一次対応（外部要因）/)).toBeInTheDocument();
    expect(
      screen.getByText(/エスカレーション草案.*宛先チームへ引き継ぎ/),
    ).toBeInTheDocument();
  });

  it("memory origin は前回の対応バッジを出す（既知/類似）", () => {
    render(
      <NextActionCard
        next={{ origin: "memory", text: "接続プール上限を拡張して復旧" }}
      />,
    );
    expect(screen.getByText("次のアクション")).toBeInTheDocument();
    expect(screen.getByText("接続プール上限を拡張して復旧")).toBeInTheDocument();
    expect(screen.getByText(/前回の対応をなぞる/)).toBeInTheDocument();
  });
});
