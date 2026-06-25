import { InfraEvidence } from "./InfraEvidence.js";

export type { InfraEvidence };

export interface InvestigationContext {
  readonly errorEvent: {
    eventName: string;
    occurredOn: string;
    payload: Record<string, unknown>;
    /** ソースが観測時点で付与した重大度。AIはこれを事前情報（prior）として精緻化する。 */
    severity: string;
  };
  readonly knownPatterns: Array<{
    name: string;
    description: string;
    eventNamePattern: string;
  }>;
  readonly similarIncidents: Array<{
    eventName: string;
    occurredOn: string;
    resolvedNote: string;
  }>;
  readonly infraEvidence?: InfraEvidence;
  /**
   * 相関判定の候補＝同時期に開いている他のアラート。AI はこの中からのみ
   * relatedAlerts を選ぶ（存在しない alertId を作らせない）。空・未設定なら相関なし。
   */
  readonly candidateAlerts?: Array<{
    alertId: string;
    eventName: string;
    category: string;
    occurredOn: string;
    summary: string;
  }>;
  /**
   * 人間が再調査時に書き込んだ指摘（前回調査の誤り・どう直すか）。
   * 自動調査（unknown 分類時）では未設定。再調査トリガー（人手）でのみ載り、
   * AI は最優先の手がかりとして前回の結論を見直す。
   */
  readonly operatorNote?: string;
}
