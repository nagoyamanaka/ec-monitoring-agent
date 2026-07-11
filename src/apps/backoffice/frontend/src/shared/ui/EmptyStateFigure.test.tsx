import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { EmptyStateFigure } from "./EmptyStateFigure";

describe("EmptyStateFigure", () => {
  it("装飾なので aria-hidden・BrandMark と同一の軌跡座標を保つ", () => {
    const { container } = render(<EmptyStateFigure />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden");
    // 幾何の同一性（「次の一点」の軌跡）を座標で固定する。
    expect(container.querySelector("polyline")).toHaveAttribute(
      "points",
      "14,45 27,45 36,32.4",
    );
  });

  it("awaiting は cyan の中空リング（予測=未着）を描く", () => {
    const { container } = render(<EmptyStateFigure variant="awaiting" />);
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("fill", "none");
    expect(circle).toHaveAttribute("stroke", "#22d3ee");
  });

  it("disabled は cyan を使わず無彩（currentColor）の中空リングにする", () => {
    const { container } = render(<EmptyStateFigure variant="disabled" />);
    const circle = container.querySelector("circle");
    expect(circle).toHaveAttribute("fill", "none");
    expect(circle).toHaveAttribute("stroke", "currentColor");
  });
});
