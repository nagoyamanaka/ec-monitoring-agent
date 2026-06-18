import { EnumValueObject } from "../../../Shared/domain/value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export enum AlertStatuses {
  OPEN = "OPEN",
  ANALYZING = "ANALYZING",
  RESOLVED = "RESOLVED",
}

export class AlertStatus extends EnumValueObject<AlertStatuses> {
  constructor(value: AlertStatuses) {
    super(value, Object.values(AlertStatuses));
  }

  static open(): AlertStatus {
    return new AlertStatus(AlertStatuses.OPEN);
  }

  static analyzing(): AlertStatus {
    return new AlertStatus(AlertStatuses.ANALYZING);
  }

  static resolved(): AlertStatus {
    return new AlertStatus(AlertStatuses.RESOLVED);
  }

  static fromString(value: string): AlertStatus {
    return new AlertStatus(value as AlertStatuses);
  }

  isOpen(): boolean {
    return this.value === AlertStatuses.OPEN;
  }

  isAnalyzing(): boolean {
    return this.value === AlertStatuses.ANALYZING;
  }

  isResolved(): boolean {
    return this.value === AlertStatuses.RESOLVED;
  }

  protected throwErrorForInvalidValue(value: AlertStatuses): void {
    throw new InvalidArgumentError(`Invalid AlertStatus: "${value}"`);
  }
}
