import { EnumValueObject } from "../../../Shared/domain/value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export enum AlertSeverities {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  INFO = "INFO",
  PENDING = "PENDING",
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

  /** AI調査完了前の未確定状態。attachInvestigationReport で上書きされる。 */
  static pending(): AlertSeverity {
    return new AlertSeverity(AlertSeverities.PENDING);
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

  isPending(): boolean {
    return this.value === AlertSeverities.PENDING;
  }

  protected throwErrorForInvalidValue(value: AlertSeverities): void {
    throw new InvalidArgumentError(`Invalid AlertSeverity: "${value}"`);
  }
}
