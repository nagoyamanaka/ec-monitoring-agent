# 設計書（step 系）索引

> ここは**設計の経緯・理由を残す歴史的ドキュメント**の置き場。実装が進んでおり、記述が現状と食い違う箇所がある。**現状の正はコードと [docs/architecture.md](../architecture.md)**。意思決定の要約は [docs/decisions/ADR.md](../decisions/ADR.md) を参照。

| ファイル | 内容 | 状態 |
| --- | --- | --- |
| [step1-directory-structure.md](step1-directory-structure.md) | ディレクトリ構成（DDD + Clean Architecture + CQRS + EDA） | 確定 |
| [step2-domain-model.md](step2-domain-model.md) | EC ドメインモデル | 確定 |
| [step3-application-layer.md](step3-application-layer.md) | EC アプリケーション層 | 確定 |
| [step4-1-strategy.md](step4-1-strategy.md) | 戦略設計（差別化・検知境界 §2.5・技術方針 §4・予兆構想 §7・SSE/pull 境界 §10・デプロイトポロジ §11・モジュール境界 §12） | 確定・現役参照 |
| [step4-2-monitoring-context.md](step4-2-monitoring-context.md) | Monitoring コンテキスト本体（分類・AI 調査・学習ループ・ADK） | 実装済み |
| [step4-3-backoffice-backend.md](step4-3-backoffice-backend.md) | Express 配線・SSE・ingest | 実装済み |
| [step4-4-backoffice-frontend.md](step4-4-backoffice-frontend.md) | フロントエンド（feature-sliced・観測コンソール） | 実装済み |
| [step4-5-backoffice-infra.md](step4-5-backoffice-infra.md) | インフラ（GCP/Terraform/CI・GCP 完結型可観測性） | 実装済み |

決定記録・ADR は [docs/decisions/](../decisions/) を参照。

## 既知のドリフト（コードが正・主なもの）

- **Gemini SDK/モデル**: docs は `@google/generative-ai`・`gemini-2.0-flash` と書くが、実装は **`@google/genai`・既定 `gemini-2.5-pro`・Vertex AI 経路（`GOOGLE_GENAI_USE_VERTEXAI=true`・ADC）が本番既定**。`VertexLLMClient` は別クラスとしては作らず env 切替で実現。
- **フェーズ0〜3 は全て実装済み**（単一 Gemini／ADK 8エージェント／SimilarPatternRule 類似分類／学習ループ・昇格）。docs の「未実装・次フェーズ」表記の多くは古い。
- **既知/類似は AI 自動起動しない**（即確定・オンデマンドで `POST /alerts/:id/report`）。「既知でも毎回 AI」と読める古い記述は無効。
- **シナリオ6/7 の自動修正は見送り**（調査まで）。[決定記録](../decisions/decision-scenario67-remediation-dropped.md) が正。その後 2026-07-06 に旧5（構成変更）・旧6（アプリコード退行）はシナリオ自体もデモ卓から撤退（実装は git 履歴に残置）。
- **デモ操作卓は 5 ボタン**（1/2/3/3b/4）。旧「在庫競合」廃止で -1 繰り上げ済み・旧5/6 は撤退済み。「8 ボタン」等の古い記述は無効（現行一覧は [architecture.md §9](../architecture.md#9-デモシナリオ5ボタンリアルさバッジ付き)）。
- **承認済みアラートは dedup 窓から除外**され、Analytics ページに承認済み一覧がある（2026-07 追加）。承認→昇格→再発1秒既知→却下→再調査の一生と、訂正が次回 SIMILARITY 分類の正になる学習一周は `e2e/backoffice/feedback-lifecycle.e2e.test.ts` が担保。
- **予兆（Forecast）は実装済み**（`GET/POST/DELETE /forecast`・引用検証・E2E あり）。「未実装・stretch」と読める古い記述は無効（現状は [architecture.md §10](../architecture.md#10-予兆ブリーフィングforecast実装済み)）。
- **テスト実測は 2026-07-10 時点で unit 1,103件/155ファイル＋ HTTP API E2E 22件/7ファイル**。step 系に散在する古い件数はその時点のスナップショット。
