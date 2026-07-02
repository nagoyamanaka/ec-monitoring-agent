# Step 4-5: GCP 完結型デプロイ＆可観測性（設計・コンテキスト）

> 対応 TODO: `docs/steps/step4-5-backoffice-infra.todo.md`
> 上位設計: `docs/steps/step4-1-strategy.md` §11（ハイブリッド構成 / webhook / OTel）
> 関連: `infra/terraform/`（IaC 一式・実装済み）/ `.github/workflows/terraform.yml`（plan/apply・WIF）
>
> **このドキュメントの目的**: 「作った Terraform を実際に GCP 上で動かし、`Cloud Monitoring（検知）→ ingest（受信）→ AI 調査` のラインを通す」までのロードマップを、**現状のコード・git changes に整合する形**で定義する。Datadog/Kibana を使わず、ログ調査（Cloud Logging）・インフラ監視（Cloud Monitoring）・分散追跡（Cloud Trace）を GCP コンソール 1 つに集約する「GCP 完結型可観測性」が狙い。

---

## 1. なぜこの doc を分けたか（step4-2/4-3 との関係）

当初「GCP 可観測性タスク #1〜#6」として 6 項目を構想したが、コードと IaC を突き合わせると **半分は実装済み or 既存 TODO と重複**していた。重複・完了を排除し、**純粋に「デプロイして動かす」残作業だけ**をこの doc に集約する。

| 構想 | 実態 | この doc での扱い |
|---|---|---|
| #1 CI/CD 初デプロイ | `terraform.yml` / `infra/terraform/` 完成済み・**未実行** | ✅ 本体（Phase 1） |
| #2 ingest `?token=` 対応 | コントローラはヘッダのみ | step4-3 stretchⅠ タスク20 を**ここへ移動**（T1） |
| #3 worker/edge 分離 + RedisSSE | コード未実装 | **本ロードマップ外**＝step4-3 stretchⅠ タスク16-19 が正。順序整合のため参照のみ（§4） |
| #4 ログベースメトリクス→アラート | logging/monitoring に雛形あり・FATAL 検知無し | 🟡 Phase 2（穴埋め） |
| #5 OTel → Cloud Trace | exporter 実装済み・**IAM/計装に穴** | 🟡 Phase 3（穴埋め） |
| #6 Log-Trace 紐付け | `GcpCloudLoggingLogger` で実装済み | ✅ 完了（動作確認のみ） |

加えて、検知ソース正規化の仕上げ（step4-2 stretchⅠ タスク31/32）も**デプロイ後の疎通検証**に直結するため、ここへ移動・参照する。

---

## 2. 現状の到達点（2026-06 コード調査）

**実装済み（やることなし or 確認のみ）**:
- IaC 一式: `bootstrap / networking / iam(WIF) / gce-backbone / cloud-run / monitoring / logging`（`infra/terraform/`）
- CI: `.github/workflows/terraform.yml`（PR=plan / main=apply・environment 承認ゲート・WIF キーレス）
- OTel: `start.ts` に `NodeSDK` + `@google-cloud/opentelemetry-cloud-trace-exporter`（Cloud Trace への export 結線済み）
- **Log-Trace 相関（#6）**: `Shared/infrastructure/logging/GcpCloudLoggingLogger.ts` が `logging.googleapis.com/trace` / `spanId` を構造化ログに注入済み。Winston/Pino は使わず素の JSON stdout（GCE Ops Agent / Cloud Run が回収）＝**追加ライブラリ不要で完了**
- 検知正規化: `CloudMonitoringAlertTranslator` が `incident.*` → `MonitoringEvent`（INFRASTRUCTURE/CAPACITY 振り分け・closed→info=非 alertable）まで実装済み＋UT あり
- compose: `valkey` サービス追加・`REDIS_URL` 注入済み（アプリ未読込なら no-op）

**未実装の穴（このロードマップで埋める）**:
1. **ingest が URL クエリトークン非対応** — `CloudMonitoringAlertIngestController` は `x-ingest-token` ヘッダのみ。Cloud Monitoring の `webhook_tokenauth` は `?token=` で送るため**疎通が原理的に繋がらない**（T1）
2. **compose が `build:` のまま** — GCE backbone は compose だけ pull しビルド元を持たない。`image: ${IMAGE_*}` 参照化が必須（T2）
3. **`roles/cloudtrace.agent` がどこにも無い** — cloud-run / gce-backbone の SA は logWriter/metricWriter/aiplatform.user 止まり。**トレースが書き込めない**（T9）
4. **auto-instrumentation 未導入** — exporter はあるが `@opentelemetry/auto-instrumentations-node` が無く HTTP/Mongo/Valkey が自動計装されない＝トレースがスカスカ（T10）
5. **FATAL エラー検知メトリクスが無い** — logging module の log-based metric は `action="alert_ingested"` の計数のみ。重大エラー（`severity=FATAL`）→アラート発報のラインが未構成（T7）
6. **Cloud Run の env 配線が薄い** — `GEMINI_MODEL` 等の追加・secret 値の実投入（T3/T5）

---

## 3. 設計判断・デプロイ時の罠（インフラ）

### 3.1 #2 は #1 の前提（別フェーズではない）
`webhook_tokenauth` はトークンを **URL クエリ** に付与する仕様（`modules/monitoring/main.tf` のコメント参照）。T1（`?token=` 受理）を入れない限り Phase 1 のゴール「監視→ingest 疎通」は通らない。よって **T1 はデプロイ前のコード修正**として最優先。

### 3.2 単一イメージ暫定デプロイの SSE 破綻（#3 の必然性）
worker/edge 分離前は GCE backbone と Cloud Run が**同一イメージで両方 RabbitMQ を購読**する。競合コンシューマでイベント処理は壊れないが、**SSE が破綻**する（アラートを処理したインスタンスと SSE クライアントが繋がるインスタンスが別になりうる）。
- **回避策（Phase 1 暫定）**: Cloud Run を `min=max=1` 運用にし、SSE クライアントは単一インスタンスに固定する。`in-process EventEmitterSSEAlertNotifier` のまま動く。
- **恒久策（本ロードマップ外）**: `RedisSSEAlertNotifier` + read-model + `ROLE` 分離＝**step4-3 stretchⅠ タスク16-19**。多インスタンス/scale-to-zero の物語はそこで初めて成立する。

### 3.3 本番 write は人間承認の内側（不変条件）
`terraform apply` は CI の `environment: prod` 承認ゲート経由。Secret の平文は tf に置かず `gcloud secrets versions add` で投入。read-only 原則（証拠 Gateway 群）と整合。

---

## 4. フェーズ構成（順序整合）

```
Phase 0  デプロイ前コード修正        T1(ingest token) → T2(compose image化) → T3(cloud-run env配線)
Phase 1  初回デプロイ＆垂直疎通(#1)  T4(手動前提) → T5(apply) → T6(apply後注入) → 疎通テスト
Phase 2  エラー自動発報(#4)          T7(FATAL log metric+policy) → 疎通テスト
Phase 3  可観測性仕上げ(#5/#6)       T9(cloudtrace.agent) → T10(auto-instrument) → T11(相関確認)
─────────────────────────────────────────────────────────────────────
別トラック(本ロードマップ外)         step4-3 stretchⅠ 16-19（#3 worker/edge・RedisSSE）
                                    ＝Phase 1 が動いた後・多インスタンス化する時に着手
任意・次フェーズ                     T12 CloudMonitoringGateway（pull 証拠・旧 step4-2 task32）
```

各タスクの前提条件（特に step4-3 stretchⅠ への依存）は TODO 側のタスクコメントに明記する。

---

## 5. 完了の定義（DoD）

- **Phase 1**: `https://<cloud-run>/ingest/cloud-monitoring?token=xxx` への手動 POST が 202 で受理され、`AnalyzeAlert` が走り Mongo に Alert が保存される。Cloud Monitoring のサンプル 5xx ポリシーが発火→webhook→ingest まで届く。
- **Phase 2**: アプリが `severity=FATAL` を吐く→log-based metric が増加→alert policy が発火→ingest webhook が叩かれる、が GCP 内で完結。
- **Phase 3**: Cloud Trace にリクエスト/Mongo/Valkey スパンが出る。Cloud Logging のエラーログから 1 クリックで対応トレースへジャンプできる（#6 の動作確認）。
