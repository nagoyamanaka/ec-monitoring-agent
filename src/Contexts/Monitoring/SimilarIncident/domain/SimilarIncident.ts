import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";

export type SimilarIncident = {
  readonly id: string;
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly resolvedNote: string; // オペレーターのメモまたはAI分析summary（人間可読・表示用）
  // 字句類似（Jaccard）のインデックス本文。未指定は resolvedNote にフォールバック（表示と突合の分離）。
  readonly searchText?: string;
  readonly resolvedAt: Date;
  readonly severity: AlertSeverity;
  // 元になった解決済み Alert への back-link（UI からのディープリンク用）。
  // optional: seed や将来の非 Alert 源（CI/infra ingest）は持たないため。
  readonly sourceAlertId?: string;
};
