import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoConsoleFrame } from "./DemoConsoleFrame";

describe("DemoConsoleFrame", () => {
  it("aria-label 付き section として描画し、破線ボーダーと DEMO タグで本番 UI と隔離する", () => {
    render(
      <DemoConsoleFrame ariaLabel="デモコンソール">
        <p>中身</p>
      </DemoConsoleFrame>,
    );
    const section = screen.getByRole("region", { name: "デモコンソール" });
    // 色に依存しない境界の手掛かり（グレースケールでも判別できる）＝破線＋タグ。
    expect(section.className).toContain("border-dashed");
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("中身")).toBeInTheDocument();
  });
});
