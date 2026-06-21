import { describe, expect, it } from "vitest";
import { alertReviewState, isAlertReviewed } from "./alertReview";
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
