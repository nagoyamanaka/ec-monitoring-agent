import { EnumValueObject } from "../../../Shared/domain/value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export enum AlertSeverities {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  INFO = "INFO",
}

export class AlertSeverity extends EnumValueObject<AlertSeverities> {
  constructor(value: AlertSeverities) {
    super(value, Object.values(AlertSeverities));
  }

  static critical(): AlertSeverity {
    return new AlertSeverity(AlertSeverities.CRITICAL);
  }

  static warning(): AlertSeverity {
    return new AlertSeverity(AlertSeverities.WARNING);
  }

  static info(): AlertSeverity {
    return new AlertSeverity(AlertSeverities.INFO);
  }

  static fromString(value: string): AlertSeverity {
    return new AlertSeverity(value as AlertSeverities);
  }

  isCritical(): boolean {
    return this.value === AlertSeverities.CRITICAL;
  }

  isWarning(): boolean {
    return this.value === AlertSeverities.WARNING;
  }

  isInfo(): boolean {
    return this.value === AlertSeverities.INFO;
  }

  protected throwErrorForInvalidValue(value: AlertSeverities): void {
    throw new InvalidArgumentError(`Invalid AlertSeverity: "${value}"`);
  }
}
