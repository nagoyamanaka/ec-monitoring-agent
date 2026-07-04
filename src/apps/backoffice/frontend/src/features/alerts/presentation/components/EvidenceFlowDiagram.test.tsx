import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidenceFlowDiagram } from "./EvidenceFlowDiagram";
import { evidenceFlowModel } from "../../domain/evidenceFlow";
import { makeReport } from "../../test-support/alertFixture";

const report = makeReport({
  confidence: 0.7,
  metrics: {
    elapsedMs: 143_000,
    evidenceCounts: {
      logs: 4,
      metrics: 0,
      terraformChanges: 0,
      commits: 6,
      similarIncidents: 5,
    },
  },
});
const model = evidenceFlowModel(report)!;

describe("EvidenceFlowDiagram", () => {
  it("流入源（>0のみ）・件数・経過時間・確信度を実測で描画する", () => {
    render(<EvidenceFlowDiagram model={model} />);

    expect(screen.getByText("Cloud Logging")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("類似事例DB")).toBeInTheDocument();
    // 0件のソース（Cloud Monitoring / Terraform）は「流入した」と主張しない
    expect(screen.queryByText("Cloud Monitoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Terraform")).not.toBeInTheDocument();

    expect(screen.getByText("4件")).toBeInTheDocument();
    expect(screen.getByText("143秒")).toBeInTheDocument();
    expect(screen.getByText("15 件")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    // 視覚部の代替テキスト（読み上げ用1文）
    expect(screen.getByText(model.ariaSummary)).toBeInTheDocument();
  });

  it("AI 調査ノードの台帳ツールチップは登場エージェントを ✓ でマークする", () => {
    render(
      <EvidenceFlowDiagram
        model={model}
        steps={[{ text: "root_cause_analystで根本原因を分析" }]}
      />,
    );

    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip).toHaveTextContent("エージェント台帳");
    expect(tooltip).toHaveTextContent("✓＝この調査のステップに登場");
    // 全7エージェントの台帳＋登場したものだけ data-mentioned
    expect(tooltip).toHaveTextContent("Coordinator");
    expect(tooltip).toHaveTextContent("RootCauseAnalyst");
    expect(
      tooltip.querySelectorAll('[data-mentioned="true"]'),
    ).toHaveLength(1);
  });

  it("エージェント言及の無いステップでは台帳をハイライト無しで出す", () => {
    render(<EvidenceFlowDiagram model={model} steps={[{ text: "ログ確認" }]} />);
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip).not.toHaveTextContent("この調査のステップに登場");
    expect(
      tooltip.querySelectorAll('[data-mentioned="true"]'),
    ).toHaveLength(0);
  });

  it("キャリブレーション記録があればゲージ直下に「なぜこの値か」を併記する", () => {
    render(
      <EvidenceFlowDiagram
        model={model}
        calibration={{
          signals: ["similar_incident"],
          cap: 0.7,
          original: 0.8,
        }}
      />,
    );
    expect(screen.getByText(/裏付け: 類似事例/)).toBeInTheDocument();
    expect(
      screen.getByText(/AI 自己申告 80% を裏付け上限で 70% に補正済み/),
    ).toBeInTheDocument();
  });
});
