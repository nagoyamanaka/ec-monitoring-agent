import type { AlertPrimitives } from "../../domain/Alert.js";

/**
 * Alert の read-model（CQRS read side・案②）を隔離するポート。
 * AlertPrimitives（ワイヤ/投影形）を id キーで upsert し、一覧スナップショットを別キーで保持する。
 *
 * SoT は常に Mongo（AlertRepository）。本ストアは「再構築可能な projection」であって真実ではない。
 * 実装は Valkey（RedisAlertReadModelStore）。REDIS_URL 無効時はそもそも本ストアを噛ませず
 * MongoAlertRepository を素通しする（現状動作を壊さない）ため、no-op 実装は持たない。
 */
export interface AlertReadModelStore {
  getAlert(id: string): Promise<AlertPrimitives | null>;
  saveAlert(alert: AlertPrimitives): Promise<void>;
  getList(): Promise<AlertPrimitives[] | null>;
  saveList(alerts: AlertPrimitives[]): Promise<void>;
  invalidateList(): Promise<void>;
}
