# 設計書（step 系）索引

> ここは**設計の経緯・理由を残す歴史的ドキュメント**の置き場。実装が進んでおり、記述が現状と食い違う箇所がある。**現状の正はコードと [docs/architecture.md](../architecture.md)**。

| ファイル | 内容 | 状態 |
| --- | --- | --- |
| [project-prompt.md](project-prompt.md) | 設計エージェント向けマスタープロンプト（全体像・v19系） | 歴史的（ドリフトあり・下記） |
| [step1-directory-structure.md](step1-directory-structure.md) | ディレクトリ構成 | 確定 |
| [step2-domain-model.md](step2-domain-model.md) | EC ドメインモデル | 確定 |
| [step3-application-layer.md](step3-application-layer.md) / [todo](step3-application-todo.md) | EC アプリケーション層 | 確定 |
| [step4-1-strategy.md](step4-1-strategy.md) / [todo](step4-1-strategy-todo.md) | 戦略（差別化・検知境界・予兆構想 §7） | 確定・現役参照 |
| [step4-2-monitoring-context.md](step4-2-monitoring-context.md) / [todo](step4-2-monitoring-context-todo.md) | Monitoring コンテキスト本体 | 実装済み（予兆タスクは step6 へ移動） |
| [step4-3-backoffice-backend.md](step4-3-backoffice-backend.md) / [todo](step4-3-backoffice-backend-todo.md) | Express 配線・SSE・ingest | 実装済み（同上） |
| [step4-4-backoffice-frontend.md](step4-4-backoffice-frontend.md) / [todo](step4-4-backoffice-frontend-todo.md) | フロントエンド | 実装済み（同上） |
| [step4-5-backoffice-infra.md](step4-5-backoffice-infra.md) / [todo](step4-5-backoffice-infra.todo.md) | インフラ（GCP/Terraform/CI） | 実装済み |
| [step6-final-sprint-strategy.md](step6-final-sprint-strategy.md) / [todo](step6-final-sprint-todo.md) | **現役**: 7/10 締切スプリント（予兆×デモ防御） | 進行中 |
| [step6-submission-prompt.md](step6-submission-prompt.md) | **現役**: 提出資料作成用プロンプト（ブラウザ Claude 用） | 進行中 |

決定記録は [docs/decisions/](../decisions/) を参照。

## 既知のドリフト（コードが正・主なもの）

- **Gemini SDK/モデル**: docs は `@google/generative-ai`・`gemini-2.0-flash` と書くが、実装は **`@google/genai`・既定 `gemini-2.5-pro`・Vertex AI 経路（`GOOGLE_GENAI_USE_VERTEXAI=true`・ADC）が本番既定**。`VertexLLMClient` は別クラスとしては作らず env 切替で実現。
- **フェーズ0〜3 は全て実装済み**（単一 Gemini／ADK 8エージェント／SimilarPatternRule 類似分類／学習ループ・昇格）。docs の「未実装・次フェーズ」表記の多くは古い。
- **既知/類似は AI 自動起動しない**（即確定・オンデマンドで `POST /alerts/:id/report`）。「既知でも毎回 AI」と読める古い記述は無効。
- **シナリオ6/7 の自動修正は見送り**（調査まで）。[決定記録](../decisions/decision-scenario67-remediation-dropped.md) が正。その後 2026-07-06 に旧5（構成変更）・旧6（アプリコード退行）はシナリオ自体もデモ卓から撤退（実装は git 履歴に残置）。
- **デモ操作卓は 5 ボタン**（1/2/3/3b/4）。旧「在庫競合」廃止で -1 繰り上げ済み・旧5/6 は撤退済み。「8 ボタン」等の古い記述は無効（現行一覧は [architecture.md §9](../architecture.md#9-デモシナリオ5ボタンリアルさバッジ付き)）。
- **承認済みアラートは dedup 窓から除外**され、Analytics ページに承認済み一覧がある（2026-07 追加）。承認→昇格→再発1秒既知→却下→再調査の一生と、訂正が次回 SIMILARITY 分類の正になる学習一周は `e2e/backoffice/feedback-lifecycle.e2e.test.ts` が担保。
- **予兆（Forecast）は実装済み**（F1〜F12 着地・`GET/POST/DELETE /forecast`・E2E あり）。残りは実 PR ステージングと録画の人間タスクのみ。「未実装」と読める古い記述は無効。
- **テスト実測は 2026-07-06 時点で unit 1017件/146ファイル＋ HTTP API E2E 22件/7ファイル**。step 系に散在する「694件」等はその時点のスナップショット。
