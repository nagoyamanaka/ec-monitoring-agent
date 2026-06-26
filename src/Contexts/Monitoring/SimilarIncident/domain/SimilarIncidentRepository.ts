import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { SimilarIncident } from "./SimilarIncident.js";

// インデックス登録用（正解フィードバック時に解決済みインシデントとして登録する）
export type ResolvedIncident = {
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly resolvedNote: string;
  readonly severity: AlertSeverity;
  // 元になった解決済み Alert の id（UI ディープリンク用の back-link）。
  readonly sourceAlertId?: string;
};

// 類似度スコア付きの検索ヒット。score は検索バックエンドが返す関連度（高いほど類似）。
// [0,1] への正規化は consumer（SimilarPatternRule）の責務（バックエンド依存の飽和点を吸収する）。
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
  // graded confidence 分類用のスコア付き検索（SimilarPatternRule が利用）。
  search(query: SimilarSearchQuery): Promise<ScoredIncident[]>;
}
