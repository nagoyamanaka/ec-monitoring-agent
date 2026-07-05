import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CitationChips } from "./CitationChips";
import type { CitationRefView } from "../../domain/InvestigationReportView";

const refs: CitationRefView[] = [
  { value: "ec.db.connection_pool_exhausted", kind: "event" },
  {
    value: "e12b655",
    kind: "commit",
    href: "https://github.com/acme/ec/commit/e12b655",
  },
  { value: "appLogs: 謎のログ" },
];
const citations = refs.map((r) => r.value);

describe("CitationChips", () => {
  it("refs ありなら畳んだままでも照合サマリ（✓ n/m 実在照合済み）が見える", () => {
    render(<CitationChips heading="算定根拠（引用）" citations={citations} refs={refs} />);
    expect(screen.getByText("✓ 2/3 実在照合済み")).toBeInTheDocument();
    // 既定は折りたたみ＝引用本体はまだ出ない。
    expect(screen.queryByText("ec.db.connection_pool_exhausted")).not.toBeInTheDocument();
  });

  it("展開すると出所ラベル＋✓照合済み／未照合が引用ごとに出て、href はリンクになる", async () => {
    render(<CitationChips heading="算定根拠（引用）" citations={citations} refs={refs} />);
    await userEvent.click(screen.getByRole("button", { name: /算定根拠/ }));

    // 何のパラメータかのラベル（受信イベント名＝ingest 境界の正典 ID）。
    expect(screen.getByText("受信イベント名")).toBeInTheDocument();
    expect(screen.getByText("ec.db.connection_pool_exhausted")).toBeInTheDocument();
    expect(screen.getAllByText("✓ 照合済み")).toHaveLength(2);
    // 未照合も隠さず出す（正直さの担保）。
    expect(screen.getByText("appLogs: 謎のログ")).toBeInTheDocument();
    expect(screen.getByText("未照合")).toBeInTheDocument();
    // commit はリンク解決される。
    expect(screen.getByRole("link", { name: "e12b655" })).toHaveAttribute(
      "href",
      "https://github.com/acme/ec/commit/e12b655",
    );
  });

  it("refs なし（旧データ）は従来のプレフィックス推測表示にフォールバックし、照合バッジは出さない", async () => {
    render(<CitationChips heading="算定根拠（引用）" citations={["commit: abc1234"]} />);
    expect(screen.queryByText(/実在照合済み/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /算定根拠/ }));
    expect(screen.getByText("commit: abc1234")).toBeInTheDocument();
    expect(screen.queryByText("✓ 照合済み")).not.toBeInTheDocument();
  });

  it("引用ゼロなら何も描画しない", () => {
    const { container } = render(
      <CitationChips heading="算定根拠（引用）" citations={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
