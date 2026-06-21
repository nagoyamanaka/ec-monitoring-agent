import { Response } from "express";
import { AlertPrimitives } from "../../AlertAnalysis/domain/Alert.js";

export interface SSEAlertNotifier {
  notify(alertPrimitives: AlertPrimitives): void;
  addConnection(res: Response): void;
  removeConnection(res: Response): void;
}
