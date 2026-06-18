import { Alert } from "./Alert.js";
import { AlertId } from "./AlertId.js";
import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";

export interface AlertRepository {
  save(alert: Alert): Promise<void>;
  findById(id: AlertId): Promise<Alert | null>;
  findByCriteria(criteria: Criteria): Promise<Alert[]>;
}
