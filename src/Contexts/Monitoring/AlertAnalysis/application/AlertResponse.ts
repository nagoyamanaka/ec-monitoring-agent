import { Response } from "../../../Shared/domain/Response.js";
import { Alert, AlertPrimitives } from "../domain/Alert.js";

export class AlertResponse implements Response {
  public readonly alerts: AlertPrimitives[];

  constructor(alerts: Alert[]) {
    this.alerts = alerts.map((a) => a.toPrimitives());
  }
}
