import { EnumValueObject } from "../../../Shared/domain/value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export enum ReviewStatuses {
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export class ReviewStatus extends EnumValueObject<ReviewStatuses> {
  constructor(value: ReviewStatuses) {
    super(value, Object.values(ReviewStatuses));
  }

  static pendingReview(): ReviewStatus {
    return new ReviewStatus(ReviewStatuses.PENDING_REVIEW);
  }

  static approved(): ReviewStatus {
    return new ReviewStatus(ReviewStatuses.APPROVED);
  }

  static rejected(): ReviewStatus {
    return new ReviewStatus(ReviewStatuses.REJECTED);
  }

  static fromString(value: string): ReviewStatus {
    return new ReviewStatus(value as ReviewStatuses);
  }

  isPendingReview(): boolean {
    return this.value === ReviewStatuses.PENDING_REVIEW;
  }

  isApproved(): boolean {
    return this.value === ReviewStatuses.APPROVED;
  }

  isRejected(): boolean {
    return this.value === ReviewStatuses.REJECTED;
  }

  protected throwErrorForInvalidValue(value: ReviewStatuses): void {
    throw new InvalidArgumentError(`Invalid ReviewStatus: "${value}"`);
  }
}
