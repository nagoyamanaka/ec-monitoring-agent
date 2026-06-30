import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RelatedAlertsPanel } from "./RelatedAlertsPanel";
import { makeAlert, makeReport } from "../../test-support/alertFixture";

describe("RelatedAlertsPanel", () => {
  it("関連が無ければ何も描画しない", () => {
    const { container } = render(
      <MemoryRouter>
        <RelatedAlertsPanel alert={makeAlert({ report: makeReport() })} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("AI 相関を関係ラベル・根拠・詳細リンク付きで出す", () => {
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          {
            alertId: "related-1",
            relation: "downstream",
            rationale: "決済タイムアウトの波及で注文処理が失敗",
          },
        ],
      }),
    });

    render(
      <MemoryRouter>
        <RelatedAlertsPanel alert={alert} />
      </MemoryRouter>,
    );

    expect(screen.getByText("関連アラート")).toBeInTheDocument();
    expect(screen.getByText("波及（下流）")).toBeInTheDocument();
    expect(
      screen.getByText("決済タイムアウトの波及で注文処理が失敗"),
    ).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/alerts/related-1");
  });

  it("SIMILARITY の back-link を同型関連として出す（AlertCardExpanded から統合）", () => {
    const alert = makeAlert({
      report: null,
      classification: {
        type: "known",
        source: "SIMILARITY",
        patternId: "p",
        patternName: "類似既知",
        confidence: 0.8,
        matchedConditions: [],
        sourceAlertId: "past-1",
      },
    });

    render(
      <MemoryRouter>
        <RelatedAlertsPanel alert={alert} />
      </MemoryRouter>,
    );

    expect(screen.getByText("同型")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/alerts/past-1");
  });

  it("onNavigate ありなら Link でなく button を出し、クリックで alertId を渡す（舞台に留まる）", () => {
    const onNavigate = vi.fn();
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          { alertId: "related-1", relation: "downstream", rationale: "波及" },
        ],
      }),
    });

    render(
      <MemoryRouter>
        <RelatedAlertsPanel alert={alert} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onNavigate).toHaveBeenCalledWith("related-1");
  });

  it("lookup で解決できると関連先の severity を補完する", () => {
    const alert = makeAlert({
      report: makeReport({
        relatedAlerts: [
          { alertId: "b", relation: "same_root_cause", rationale: "同根" },
        ],
      }),
    });
    const resolved = makeAlert({ id: "b", severity: "CRITICAL" });

    render(
      <MemoryRouter>
        <RelatedAlertsPanel
          alert={alert}
          lookup={(id) => (id === "b" ? resolved : undefined)}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("同一根本原因")).toBeInTheDocument();
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
  });
});
