import { describe, expect, it } from "vitest";
import {
  alertReviewState,
  alertWorkState,
  isAlertReviewed,
} from "./alertReview";
import { makeAlert } from "../test-support/alertFixture";

describe("alertReview", () => {
  it("feedback 無しは PENDING・未レビュー", () => {
    const alert = makeAlert({ feedback: null });
    expect(alertReviewState(alert)).toBe("PENDING");
    expect(isAlertReviewed(alert)).toBe(false);
  });

  it("feedback.isCorrect=true は APPROVED", () => {
    const alert = makeAlert({ feedback: { isCorrect: true } });
    expect(alertReviewState(alert)).toBe("APPROVED");
    expect(isAlertReviewed(alert)).toBe(true);
  });

  it("feedback.isCorrect=false は REJECTED", () => {
    const alert = makeAlert({ feedback: { isCorrect: false } });
    expect(alertReviewState(alert)).toBe("REJECTED");
    expect(isAlertReviewed(alert)).toBe(true);
  });
});

describe("alertWorkState（バッジと件数集計の単一ソース）", () => {
  it("ANALYZING は feedback 未付与でもレビュー待ちにしない", () => {
    const alert = makeAlert({ status: "ANALYZING", feedback: null });
    expect(alertWorkState(alert)).toBe("ANALYZING");
  });

  it("OPEN・feedback 無しは PENDING", () => {
    const alert = makeAlert({ status: "OPEN", feedback: null });
    expect(alertWorkState(alert)).toBe("PENDING");
  });

  it("feedback 付与済みはレビュー状態を返す", () => {
    expect(alertWorkState(makeAlert({ feedback: { isCorrect: true } }))).toBe(
      "APPROVED",
    );
    expect(alertWorkState(makeAlert({ feedback: { isCorrect: false } }))).toBe(
      "REJECTED",
    );
  });
});
