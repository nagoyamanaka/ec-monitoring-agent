/**
 * 組織体制の知識ベース（read-only）。タスク35。
 *
 * 「コードで直せない他責/運用案件」を行き止まりにせず、エスカレーション草案まで自動化するための
 * 体制データを引く。SimilarIncident（過去事例＝どう直したか）とは別物で、こちらは「誰に投げるか」
 * ＝オーナー/チーム/連絡先/SLA の知識。RunbookEscalationAgent が affectedSubjects を手がかりに
 * 引き当て、エスカレーション草案の宛先・連絡先を裏付ける。
 *
 * read-only に限定する（write＝通知送信・チケット起票はしない）。実際の送信は人間承認後で、
 * 既存 RemediationPort と同じ「write は人間承認ゲートの内側」の原則を越境させない。
 */
export type EscalationDirectoryEntry = {
  // 担当チーム名（例: payment-platform）。
  readonly team: string;
  // 一次受けの担当者（オンコール代表など）。
  readonly owner: string;
  // 連絡先（Slack チャンネル・メール・PagerDuty 等）。
  readonly contact: string;
  // 対応 SLA の段階（例: P1-15m / P2-1h）。severity 根拠の補助に使う。
  readonly slaTier: string;
  // このチームが所有する主体（サービス名・ドメイン語）。affectedSubjects との突合キー。
  readonly ownsSubjects: string[];
};

export interface EscalationDirectory {
  // 影響を受けた主体（affectedSubjects）を所有するチームを引く。
  // 1 件も該当しない場合は空配列（エージェントは宛先不明として扱う）。
  findBySubjects(subjects: string[]): Promise<EscalationDirectoryEntry[]>;
}
