import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { SimilarIncident } from "./SimilarIncident.js";

// インデックス登録用（正解フィードバック時に解決済みインシデントとして登録する）
export type ResolvedIncident = {
  readonly eventName: string;
  readonly occurredOn: Date;
  // 人間が読む「当時どう直したか」＝ UI の「次のアクション（前回の対応）」に出す本文。
  readonly resolvedNote: string;
  // 字句類似（Jaccard）のインデックス本文。表示と突合を分離するための任意フィールド＝
  // 未指定なら resolvedNote にフォールバック（後方互換）。可読な resolvedNote では和文 bigram や
  // 英文の機能語でトークンが膨れてスコアが動くため、突合に効かせる語彙はここに固定する。
  readonly searchText?: string;
  readonly severity: AlertSeverity;
  // 元になった解決済み Alert の id（UI ディープリンク用の back-link）。
  readonly sourceAlertId?: string;
};

// 類似度スコア付きの検索ヒット。score は **backend 非依存で有界な字句類似度 [0,1]**（高いほど類似）。
// 各リポジトリ実装が lexicalSimilarity で算出する＝Elastic(BM25)/InMemory どちらでも同じ意味になり、
// 無界 BM25 の小コーパス飽和（無関係事例への偽 100% 一致）を防ぐ。BM25 は候補取得にのみ使う。
export type ScoredIncident = {
  readonly incident: SimilarIncident;
  readonly score: number;
};

// 類似検索クエリ。eventName は厳密フィルタ／ブースト用、text はスコアリング用の自由文。
export type SimilarSearchQuery = {
  readonly eventName: string;
  readonly text: string;
  readonly limit: number;
};

export interface SimilarIncidentRepository {
  // 件数のみ（AI調査の文脈強化用）。eventName 厳密一致＋recency。
  findSimilar(criteria: Criteria): Promise<SimilarIncident[]>;
  // 解決済みインシデントを追記する。
  index(incident: ResolvedIncident): Promise<void>;
  // 指定 Alert 由来の解決済みインシデントを撤回する（sourceAlertId 一致を全削除）。
  // 承認のやり直し（承認→却下/取消）で誤った学習を残さないために使う。該当なしは no-op。
  removeByAlertId(sourceAlertId: string): Promise<void>;
  // コーパス全消去（demo reset のクリーンスレート用・任意実装）。removeByAlertId は seed 由来 id しか
  // 消せず、過去セッションで承認学習された別 id の事例が蓄積して類似検索を汚す。reset は clear で全消去
  // してから seed を index し直す。永続 backend を持たない fake は未実装でよい（optional）。
  clear?(): Promise<void>;
  // graded confidence 分類用のスコア付き検索（SimilarPatternRule が利用）。
  search(query: SimilarSearchQuery): Promise<ScoredIncident[]>;
}
