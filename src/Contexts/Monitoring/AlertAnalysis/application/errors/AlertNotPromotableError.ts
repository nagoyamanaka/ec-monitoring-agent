import { ApplicationError } from "../../../../Shared/domain/errors/ApplicationError.js";

// 手動即時昇格は AI 調査レポート（非 fallback）を材料に KnownErrorPattern を焼き付ける。
// レポートが無い / fallback の Alert は結晶化できないため、昇格要求を 400 で弾く。
export class AlertNotPromotableError extends ApplicationError {
  readonly errorCode = "ALERT_NOT_PROMOTABLE";

  constructor(alertId: string) {
    super(
      `Alert <${alertId}> は昇格できません（有効な調査レポートが無い＝結晶化する材料が無い）`,
    );
  }
}
