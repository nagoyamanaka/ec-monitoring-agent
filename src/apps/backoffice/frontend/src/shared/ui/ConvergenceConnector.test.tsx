import { describe, expect, it } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";
import { ConvergenceConnector } from "./ConvergenceConnector";

describe("ConvergenceConnector", () => {
  it("視覚専用（aria-hidden）で描画され、参照が空でも ResizeObserver 無し環境で壊れない", () => {
    const lanesRef = createRef<HTMLUListElement>();
    const nodeRef = createRef<HTMLDivElement>();
    const { container } = render(
      <ConvergenceConnector
        lanesRef={lanesRef}
        nodeRef={nodeRef}
        weights={[1, 2, 3]}
      />,
    );
    const host = container.querySelector("[aria-hidden]");
    expect(host).not.toBeNull();
    // jsdom は getBoundingClientRect が 0 を返す＝座標を捏造せず svg を描かない。
    expect(container.querySelector("svg")).toBeNull();
  });
});
