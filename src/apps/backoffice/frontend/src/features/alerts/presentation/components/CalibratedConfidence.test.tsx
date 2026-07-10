import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CalibratedConfidence } from "./CalibratedConfidence";
import type { ConfidenceCalibrationView } from "../../domain/InvestigationReportView";

const truncatedCalibration: ConfidenceCalibrationView = {
  signals: [],
  cap: 0.4,
  original: 0.9,
};

describe("CalibratedConfidence", () => {
  it("補正の事実（自己申告→補正後）と裏付け根拠を文で出す", () => {
    render(
      <CalibratedConfidence
        calibration={truncatedCalibration}
        confidence={0.4}
      />,
    );
    expect(
      screen.getByText("AI 自己申告 90% を裏付け上限で 40% に補正済み"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("裏付けとなる証拠なし ─ 確信度上限 40%"),
    ).toBeInTheDocument();
  });

  it("実バーは自己申告幅から補正後の幅へ削られる（最終状態＝補正後）", async () => {
    render(
      <CalibratedConfidence
        calibration={truncatedCalibration}
        confidence={0.4}
      />,
    );
    // マウント直後は自己申告幅（削られる前）で描かれる。
    expect(screen.getByTestId("calibrated-bar").style.width).toBe("90%");
    // rAF 2 段の後、補正後の幅に落ち着く（transition の到達値）。
    await waitFor(() =>
      expect(screen.getByTestId("calibrated-bar").style.width).toBe("40%"),
    );
  });

  it("切り詰めが無ければゴースト無し・補正説明無しで根拠だけを出す", () => {
    render(
      <CalibratedConfidence
        calibration={{
          signals: ["known_pattern"],
          cap: 0.9,
          original: 0.85,
        }}
        confidence={0.85}
      />,
    );
    expect(screen.getByTestId("calibrated-bar").style.width).toBe("85%");
    expect(screen.queryByText(/補正済み/)).not.toBeInTheDocument();
    expect(
      screen.getByText("裏付け: 既知パターン一致 ─ 確信度上限 90%"),
    ).toBeInTheDocument();
  });
});
