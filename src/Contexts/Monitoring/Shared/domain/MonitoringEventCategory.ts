import { EnumValueObject } from "../../../Shared/domain/value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export enum MonitoringEventCategories {
  APPLICATION = "APPLICATION",
  INFRASTRUCTURE = "INFRASTRUCTURE",
  CAPACITY = "CAPACITY",
  SECURITY = "SECURITY",
}

export class MonitoringEventCategory extends EnumValueObject<MonitoringEventCategories> {
  constructor(value: MonitoringEventCategories) {
    super(value, Object.values(MonitoringEventCategories));
  }

  static application(): MonitoringEventCategory {
    return new MonitoringEventCategory(MonitoringEventCategories.APPLICATION);
  }

  static infrastructure(): MonitoringEventCategory {
    return new MonitoringEventCategory(MonitoringEventCategories.INFRASTRUCTURE);
  }

  static capacity(): MonitoringEventCategory {
    return new MonitoringEventCategory(MonitoringEventCategories.CAPACITY);
  }

  static security(): MonitoringEventCategory {
    return new MonitoringEventCategory(MonitoringEventCategories.SECURITY);
  }

  static fromString(value: string): MonitoringEventCategory {
    return new MonitoringEventCategory(value as MonitoringEventCategories);
  }

  protected throwErrorForInvalidValue(value: MonitoringEventCategories): void {
    throw new InvalidArgumentError(`Invalid MonitoringEventCategory: "${value}"`);
  }
}
