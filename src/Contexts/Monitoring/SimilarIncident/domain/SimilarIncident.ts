import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";

export type SimilarIncident = {
  readonly id: string;
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly resolvedNote: string; // オペレーターのメモまたはAI分析summary
  readonly resolvedAt: Date;
  readonly severity: AlertSeverity;
  // 元になった解決済み Alert への back-link（UI からのディープリンク用）。
  // optional: seed や将来の非 Alert 源（CI/infra ingest）は持たないため。
  readonly sourceAlertId?: string;
};
