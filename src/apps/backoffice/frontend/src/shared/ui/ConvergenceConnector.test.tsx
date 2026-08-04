import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render } from "@testing-library/react";
import { ConvergenceConnector } from "./ConvergenceConnector";

describe("ConvergenceConnector", () => {
  it("視覚専用（aria-hidden）で描画され、参照が空でも ResizeObserver 無し環境で壊れない", () => {
    const { container } = render(
      <ConvergenceConnector lanes={null} node={null} weights={[1, 2, 3]} />,
    );
    const host = container.querySelector("[aria-hidden]");
    expect(host).not.toBeNull();
    // jsdom は getBoundingClientRect が 0 を返す＝座標を捏造せず svg を描かない。
    expect(container.querySelector("svg")).toBeNull();
  });

  describe("端点が JSX 上あとに並ぶ配置（実装2箇所と同型）", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /**
     * 回帰テスト: 端点を RefObject で受けていた頃、収束先ノードの ref はコネクタの
     * layout effect 時点で未添付＝早期 return し ResizeObserver も張られず、線が永久に
     * 出なかった（dev は StrictMode の二重実行が偶然救い、本番ビルドだけ消える形で顕在化）。
     * StrictMode を使わない＝本番ビルド相当のマウントで線が出ることを固定する。
     */
    it("StrictMode 無し（本番ビルド相当）の1回のマウントで線を描く", () => {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
        top: 0,
        left: 0,
        width: 100,
        height: 96,
        bottom: 96,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          disconnect() {}
        },
      );

      function Harness() {
        const [lanesEl, setLanesEl] = useState<HTMLUListElement | null>(null);
        const [nodeEl, setNodeEl] = useState<HTMLDivElement | null>(null);
        return (
          <div>
            <ul ref={setLanesEl}>
              <li>根拠レーン</li>
            </ul>
            <ConvergenceConnector lanes={lanesEl} node={nodeEl} />
            <div ref={setNodeEl}>AI 調査</div>
          </div>
        );
      }

      const { container } = render(<Harness />);
      expect(container.querySelector("svg")).not.toBeNull();
      expect(container.querySelectorAll("svg path")).toHaveLength(1);
    });
  });
});
