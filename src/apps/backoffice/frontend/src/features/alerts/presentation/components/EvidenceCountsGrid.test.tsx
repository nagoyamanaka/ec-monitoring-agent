import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EvidenceCountsGrid } from "./EvidenceCountsGrid";

describe("EvidenceCountsGrid", () => {
  it("5カテゴリを固定表示し、0件のカテゴリも隠さない", () => {
    render(
      <EvidenceCountsGrid
        counts={{
          logs: 3,
          metrics: 0,
          terraformChanges: 1,
          commits: 5,
          similarIncidents: 0,
        }}
      />,
    );
    for (const label of [
      "ログ",
      "メトリクス",
      "Terraform",
      "コミット",
      "過去事例",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 0 セルも数字を出す（非表示にしない＝「探した結果ゼロ」が情報）。
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(
      screen.getByText("0 のカテゴリも調査済み（該当証拠なし）"),
    ).toBeInTheDocument();
  });

  it(">0 かつ遷移先セクションがあるセルだけボタン化し、クリックで onSelect が飛ぶ", () => {
    const onSelect = vi.fn();
    render(
      <EvidenceCountsGrid
        counts={{
          logs: 3,
          metrics: 0,
          terraformChanges: 1,
          commits: 5,
          similarIncidents: 2,
        }}
        navigable={new Set(["logs", "terraformChanges", "commits"])}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ログ/ }));
    expect(onSelect).toHaveBeenCalledWith("logs");
    // 過去事例は実物が本パネル外＝ >0 でもボタンにしない（navigable 外）。
    expect(
      screen.queryByRole("button", { name: /過去事例/ }),
    ).not.toBeInTheDocument();
    // 0 件セルもボタンにしない。
    expect(
      screen.queryByRole("button", { name: /メトリクス/ }),
    ).not.toBeInTheDocument();
  });

  it("keys 指定で調査対象の証拠源だけに絞る（調べていない源を 0 と偽らない）", () => {
    render(
      <EvidenceCountsGrid
        counts={{
          logs: 3,
          metrics: 0,
          terraformChanges: 0,
          commits: 5,
          similarIncidents: 0,
        }}
        keys={["logs", "commits", "similarIncidents"]}
      />,
    );
    expect(screen.getByText("ログ")).toBeInTheDocument();
    expect(screen.getByText("コミット")).toBeInTheDocument();
    // APPLICATION では調査しないメトリクス/Terraform はセル自体を出さない。
    expect(screen.queryByText("メトリクス")).not.toBeInTheDocument();
    expect(screen.queryByText("Terraform")).not.toBeInTheDocument();
  });

  it("security キーがあれば Trivy スキャンのセルを出し、クリックで onSelect が飛ぶ", () => {
    const onSelect = vi.fn();
    render(
      <EvidenceCountsGrid
        counts={{
          logs: 0,
          metrics: 0,
          terraformChanges: 0,
          commits: 10,
          similarIncidents: 0,
        }}
        securityCount={2}
        keys={["security", "logs", "commits", "similarIncidents"]}
        navigable={new Set(["security", "commits"])}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("スキャン")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /スキャン/ }));
    expect(onSelect).toHaveBeenCalledWith("security");
  });

  it("uncited のセルはグレー格下げ・引用規律の tooltip・クリック不可・注記を出す", () => {
    const onSelect = vi.fn();
    render(
      <EvidenceCountsGrid
        counts={{
          logs: 0,
          metrics: 0,
          terraformChanges: 0,
          commits: 10,
          similarIncidents: 0,
        }}
        keys={["logs", "commits", "similarIncidents"]}
        uncited={new Set(["commits"])}
        navigable={new Set(["commits"])}
        onSelect={onSelect}
      />,
    );
    // navigable に入っていても uncited（実物セクション無し）ならボタン化しない。
    expect(
      screen.queryByRole("button", { name: /コミット/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTitle(
        "GitHub: 10件収集・原因への引用なし（無関係な証拠は列挙しない）",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("収集しても原因に引用しなかった証拠は表示しません"),
    ).toBeInTheDocument();
    // 数字は cyan でなくグレー（裏付けの色を偽らない）。
    expect(screen.getByText("10")).toHaveClass("text-slate-400");
  });

  it("全カテゴリ >0 なら「0 も調査済み」の注記は出さない", () => {
    render(
      <EvidenceCountsGrid
        counts={{
          logs: 1,
          metrics: 2,
          terraformChanges: 3,
          commits: 4,
          similarIncidents: 5,
        }}
      />,
    );
    expect(
      screen.queryByText(/0 のカテゴリも調査済み/),
    ).not.toBeInTheDocument();
  });
});
