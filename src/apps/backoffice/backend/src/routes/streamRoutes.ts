import { Router } from "express";
import { SSEAlertNotifier } from "../../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";

// TODO(task6): AlertsStreamController を実装する（GET /alerts/stream・text/event-stream・heartbeat 30s）
export function registerStreamRoutes(
  _router: Router,
  _sseNotifier: SSEAlertNotifier,
): void {}
