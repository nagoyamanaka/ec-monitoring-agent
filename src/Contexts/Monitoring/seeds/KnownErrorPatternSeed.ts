import { KnownErrorPattern } from "../AlertAnalysis/domain/KnownErrorPattern.js";
import { AlertSeverity } from "../Shared/domain/AlertSeverity.js";

export const KNOWN_ERROR_PATTERN_SEEDS: KnownErrorPattern[] = [
  KnownErrorPattern.create({
    id: "a1b2c3d4-1234-4a5b-89ab-c1d2e3f4a5b6",
    name: "PAYMENT_TIMEOUT",
    description: "決済処理がタイムアウトしました。外部決済サービスへの接続に問題がある可能性があります。",
    eventNamePattern: "ec.payment.timeout",
    payloadConditions: [],
    severity: AlertSeverity.critical(),
    suggestedAction: "決済サービスのステータスを確認し、タイムアウトした注文を手動で再処理してください。",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  }),
  KnownErrorPattern.create({
    id: "b2c3d4e5-2345-4b6c-9bcd-d2e3f4a5b6c7",
    name: "INVENTORY_INSUFFICIENT",
    description: "在庫不足により商品の予約に失敗しました。",
    eventNamePattern: "ec.inventory.reservation_failed",
    payloadConditions: [{ field: "reason", value: "INSUFFICIENT_STOCK" }],
    severity: AlertSeverity.warning(),
    suggestedAction: "在庫を補充するか、該当商品を販売停止にしてください。",
    createdAt: new Date("2026-01-01T00:00:01.000Z"),
  }),
  // INVENTORY_CONCURRENT_CONFLICT は未seed（在庫競合デモシナリオは廃止済み）。
  // 楽観ロック＋指数バックオフのリトライは実装済み（ReserveInventoryUseCase）で、AI が生成した
  // 「楽観ロックを導入せよ」という推奨が実コードと矛盾するため、当該シナリオはデモから外した。
];
