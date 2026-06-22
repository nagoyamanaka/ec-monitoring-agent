import { Alert } from "./Alert.js";
import { AlertId } from "./AlertId.js";
import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";

export interface AlertRepository {
  save(alert: Alert): Promise<void>;
  findById(id: AlertId): Promise<Alert | null>;
  findByCriteria(criteria: Criteria): Promise<Alert[]>;
  /**
   * 同一 dedupKey の未解決（OPEN / ANALYZING）Alert を1件返す（無ければ null）。
   * 重複観測を新規 Alert にせず既存に畳み込む（occurrenceCount 加算）ための検索。
   * RESOLVED は対象外＝解決後に再発したら新しいインシデントとして起票する。
   */
  findOpenByDedupKey(dedupKey: string): Promise<Alert | null>;
}
