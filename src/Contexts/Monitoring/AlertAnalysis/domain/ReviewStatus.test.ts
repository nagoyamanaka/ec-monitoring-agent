import { describe, it, expect } from "vitest";
import { ReviewStatus, ReviewStatuses } from "./ReviewStatus.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("ReviewStatus", () => {
  describe("ファクトリメソッド", () => {
    it("pendingReview()でPENDING_REVIEWが生成される", () => {
      expect(ReviewStatus.pendingReview().value).toBe(ReviewStatuses.PENDING_REVIEW);
    });

    it("approved()でAPPROVEDが生成される", () => {
      expect(ReviewStatus.approved().value).toBe(ReviewStatuses.APPROVED);
    });

    it("rejected()でREJECTEDが生成される", () => {
      expect(ReviewStatus.rejected().value).toBe(ReviewStatuses.REJECTED);
    });
  });

  describe("fromString()", () => {
    it("有効な文字列からインスタンスを生成する", () => {
      expect(ReviewStatus.fromString("PENDING_REVIEW").value).toBe(ReviewStatuses.PENDING_REVIEW);
      expect(ReviewStatus.fromString("APPROVED").value).toBe(ReviewStatuses.APPROVED);
      expect(ReviewStatus.fromString("REJECTED").value).toBe(ReviewStatuses.REJECTED);
    });

    it("不正な値でInvalidArgumentErrorをthrowする", () => {
      expect(() => ReviewStatus.fromString("INVALID")).toThrow(InvalidArgumentError);
      expect(() => ReviewStatus.fromString("")).toThrow(InvalidArgumentError);
    });
  });

  describe("判定メソッド", () => {
    it("isPendingReview()が正しく動作する", () => {
      expect(ReviewStatus.pendingReview().isPendingReview()).toBe(true);
      expect(ReviewStatus.approved().isPendingReview()).toBe(false);
      expect(ReviewStatus.rejected().isPendingReview()).toBe(false);
    });

    it("isApproved()が正しく動作する", () => {
      expect(ReviewStatus.approved().isApproved()).toBe(true);
      expect(ReviewStatus.pendingReview().isApproved()).toBe(false);
      expect(ReviewStatus.rejected().isApproved()).toBe(false);
    });

    it("isRejected()が正しく動作する", () => {
      expect(ReviewStatus.rejected().isRejected()).toBe(true);
      expect(ReviewStatus.pendingReview().isRejected()).toBe(false);
      expect(ReviewStatus.approved().isRejected()).toBe(false);
    });
  });

  describe("constructor", () => {
    it("無効なEnum値を直接渡すとInvalidArgumentErrorをthrowする", () => {
      expect(() => new ReviewStatus("INVALID" as ReviewStatuses)).toThrow(InvalidArgumentError);
    });
  });
});
