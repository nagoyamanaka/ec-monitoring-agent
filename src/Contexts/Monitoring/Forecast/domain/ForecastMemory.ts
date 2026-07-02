// 過去の解決済みインシデントを突合キー subject でタグ付けした投影（突合キー(B)・read-model）。
// LLM 突合の MEMORY シグナルの供給元。projection は再構築可能＝warmUp で毎回作り直す。
export type ForecastMemoryEntry = {
  // 実在 Alert id（= SimilarIncident.sourceAlertId と同じ id 空間）。
  // 引用検証（F5）で citation がこの id に解決できる＝実在 Alert へのディープリンクが効く。
  readonly incidentId: string;
  readonly subject: string; // ★突合キー（例: "db_connection_pool_exhaustion"）
  readonly trigger: string; // 何が起きたか（例: "ec.db.connection_pool_exhausted"）
  readonly outcome: string; // どう決着したか（オペレーターのメモ／AI調査 summary 由来）
};

export interface ForecastMemoryRepository {
  // 起動時に解決済み事例から投影する。stretchⅢ では投影元を EventLogRepository に
  // 差し替える（consumer の findBySubjects はノータッチ＝projection 再構築可能の原則）。
  warmUp(): Promise<void>;
  findBySubjects(subjects: string[]): Promise<ForecastMemoryEntry[]>;
}
