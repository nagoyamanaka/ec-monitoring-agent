# Architecture Decision Records（ADR 集）

> step 系設計書（[docs/steps/](../steps/)）で「ADR 種」として散在していた意思決定を1本に集約したもの。各エントリは「決定・理由・参照」の要約であり、詳細な検討過程は参照先の設計書が正。現状のコード準拠スナップショットは [docs/architecture.md](../architecture.md)。

## 索引

| # | 決定 | 分類 |
| --- | --- | --- |
| [ADR-01](#adr-01-検知は境界の外cloud-monitoring-採用) | 検知は境界の外・Cloud Monitoring 採用 | 境界 |
| [ADR-02](#adr-02-検知の被り対策は3層correlation-エンジンは作らない) | 被り対策3層・correlation エンジン不採用 | 境界 |
| [ADR-03](#adr-03-a2a-は使わないマルチエージェントは-adk-in-process) | a2a 不使用・ADK in-process | AI |
| [ADR-04](#adr-04-category-はサブクラスでなく弁別子フィールド) | category 弁別子 | モデル |
| [ADR-05](#adr-05-調査readと修正writeの構造分離人間承認ゲート) | read/write 分離・人間承認ゲート | AI |
| [ADR-06](#adr-06-既知類似は-ai-を自動起動しないレポートはオンデマンド) | 既知は AI 自動起動しない | AI |
| [ADR-07](#adr-07-学習は承認のみ昇格は学習でなく結晶化) | 学習=承認のみ・昇格=結晶化 | 学習 |
| [ADR-08](#adr-08-デプロイは-gce-常駐--cloud-run-エッジのハイブリッド) | GCE + Cloud Run ハイブリッド | インフラ |
| [ADR-09](#adr-09-rabbitmq-を維持しpubsub-に替えない) | RabbitMQ 維持 | インフラ |
| [ADR-10](#adr-10-elasticsearch-は-gce-自前ホスト) | Elasticsearch GCE 自前ホスト | インフラ |
| [ADR-11](#adr-11-cloud-monitoring-webhook-直結cloud-function-を挟まない) | webhook 直結・Function 中継なし | インフラ |
| [ADR-12](#adr-12-valkey-を-sot-にしない) | Valkey は SoT にしない | インフラ |
| [ADR-13](#adr-13-ssr-不採用tanstack-query-は-infrastructure-層に隔離) | SSR 不採用・TanStack 隔離 | フロント |
| [ADR-14](#adr-14-リアルタイム反映は-sse-push--pull-on-demand-の1軸で割る) | SSE push / pull の1軸 | フロント |
| [ADR-15](#adr-15-iac-は-wif-キーレスmodules単一-prod-envgcs-remote-state) | IaC: WIF キーレス | インフラ |
| [ADR-16](#adr-16-予測は統計-ml-でなく-llm-推論引用検証) | 予測は LLM 推論＋引用検証 | 予兆 |
| [ADR-17](#adr-17-join-は-llm-委譲人間は3点の足場に限定) | join は LLM 委譲＋3点足場 | 予兆 |
| [ADR-18](#adr-18-突合キーは-aテキストjoin--b構造化タグへ段階移行b-採用) | 突合キー (A)→(B) 構造化タグ | 予兆 |
| [ADR-19](#adr-19-予兆は-p0-パイプライン無傷の追加レイヤーforecastsignalsource-の継ぎ目) | 予兆は追加レイヤー・Source 継ぎ目 | 予兆 |
| [ADR-20](#adr-20-予兆生成は単発-geminiadk-非使用) | 予兆は単発 Gemini・ADK 非使用 | 予兆 |
| [ADR-21](#adr-21-イベントソーシング基盤は前倒ししない相関で止め因果推論は将来) | イベントソーシングは後・因果は将来 | 予兆 |
| [ADR-22](#adr-22-プロンプトインジェクションの入力層ガードは意図的見送り) | 入力層ガード見送り（blast radius 設計） | セキュリティ |
| [ADR-23](#adr-23-cloud-trace-api-の有効化を意図的見送り) | Cloud Trace API 見送り | インフラ |
| [ADR-24](#adr-24-デモシナリオの撤退在庫競合旧56) | デモシナリオの撤退記録 | デモ |
| [ADR-25](#adr-25-investigationreport-は順応者acl-を挟まない) | モジュール境界: ACL を挟まない | モデル |
| [ADR-26](#adr-26-空応答fallbackは思考予算を落とした縮退リトライ1回で防御) | 空応答 fallback: 縮退リトライ1回 | AI |
| [ADR-27](#adr-27-ai-精度は正診率でなく誤診の検出可能性で設計する定量評価は未実施) | 精度は正診率でなく誤診の検出可能性 | AI |

---

## ADR-01: 検知は境界の外・Cloud Monitoring 採用

- **決定**: 検知（メトリクス集約・閾値発火・dedup/相関/grouping）は上流の責務＝**本システムの境界の外**に置く。検知基盤は Cloud Monitoring（Datadog ではない）。`MonitoringEvent` は「発火済みアラート」を受ける。1 ingest = 1 Alert。
- **理由**: 「既存観測基盤の上に乗る」という位置づけと、検知層を自作する矛盾を1手で解消。Datadog は有料で実際に使わない構成となり物語と矛盾、Cloud Monitoring は無料枠・GCP 中心方針に合致。回復通知等は `severity=info` → `isAlertable()=false` で観測のみ。
- **参照**: [step4-1 §2.5](../steps/step4-1-strategy.md)・[architecture.md §2](../architecture.md)

## ADR-02: 検知の被り対策は3層・correlation エンジンは作らない

- **決定**: (a) **category オーナーシップ**（APPLICATION=EC イベント権威 / INFRASTRUCTURE・CAPACITY=Cloud Monitoring 権威）で被りの大半を構造的に消す。(b) **dedupKey（`source::category::eventName`＋任意 discriminator）＋ occurrenceCount** で同型嵐を1件×N に畳む。(c) 異症状・同一根本原因の相関は **AI 調査に委譲**しエンジン化しない。
- **理由**: 複数検知ソースを持つ以上、境界での最小の突き合わせは自分の責務だが、correlation エンジンを自作すると検知層の再発明になる。(b) は冪等キー＋grouping lite に留める（aggregateId は含めない＝注文跨ぎの嵐を畳む。同一 eventName 内の別根本原因は discriminator で分離）。
- **参照**: [step4-1 §2.5–2.6](../steps/step4-1-strategy.md)・[architecture.md §2](../architecture.md)

## ADR-03: a2a は使わない・マルチエージェントは ADK in-process

- **決定**: マルチエージェント（hub-and-spoke 8体）は **ADK の in-process サブエージェント**で構成し、a2a プロトコルは使わない。`AIInvestigationPort` の DI 差し替えで単一 Gemini ⇄ ADK を切り替える。
- **理由**: 並列専門調査・自律ループは in-process 分割で実現できる。a2a は異ベンダー/別ランタイム相互運用専用で、本構成は境界をまたがない。①調査グラフ内も ②リメディエーション連携も「会話」でなく「タスク委譲」であり a2a の適用対象でない。「トークン最適化」は分割の効果であって a2a の効果ではない。
- **参照**: [step4-1 §4](../steps/step4-1-strategy.md)・[architecture.md §4](../architecture.md)

## ADR-04: category はサブクラスでなく弁別子フィールド

- **決定**: `MonitoringEvent.category`（APPLICATION/INFRASTRUCTURE/CAPACITY/SECURITY）を継承階層でなく弁別子フィールドで持つ。
- **理由**: 「どの調査担当に振るか」のディスパッチキーであり、a2a の有無や将来のエージェント構成に依存しない前方互換を保つ。検知主担当（ADR-02 の (a)）のキーにも流用。
- **参照**: [step4-1 §4](../steps/step4-1-strategy.md)

## ADR-05: 調査(read)と修正(write)の構造分離・人間承認ゲート

- **決定**: 調査 Gateway（Cloud Logging / Terraform / GitHub / 類似 DB）は**読み取り専用**。write は `RemediationPort` に隔離し、出口は draft PR のみ・自動マージなし・人間承認ゲートを越境させない。
- **理由**: 「AI が調査・人間が承認」を規約でなく構造で体現する。プロンプトインジェクション成立時の blast radius 制限（ADR-22）の土台でもある。
- **参照**: [architecture.md §5・§5.5](../architecture.md)

## ADR-06: 既知/類似は AI を自動起動しない・レポートはオンデマンド

- **決定**: 既知（完全一致）・類似分類は決定論で即確定し（約1秒・AI コストゼロ）、AI 調査は**未知のみ**自動起動。既知/類似への AI レポートが必要なら `POST /alerts/:id/report` でオンデマンド生成。
- **理由**: 根本原因が結晶化済みの既知を調査モジュールに通すのは再導出＝過大。高価な調査経路を真に新しい障害へ温存する。静的レポート再利用は鮮度で却下し、生成時は毎回新鮮な AI＋grounding。
- **参照**: [architecture.md §3](../architecture.md)・[step4-1 §8.1.2](../steps/step4-1-strategy.md)

## ADR-07: 学習は承認のみ・昇格は「学習」でなく「結晶化」

- **決定**: 学習シグナルは**承認（isCorrect=true）のみ** SimilarIncident コーパスへ index する。却下は直前承認の撤回のみで負例学習はしない。`KnownErrorPattern` への昇格は「学習」でなく**よく確認された知識の高速パスへの焼き付け（結晶化）**と位置づける（自動=閾値到達 / 手動=`POST /alerts/:id/promote`）。
- **理由**: 二値学習シグナルを濁さない。学習の本体は SimilarIncident 蓄積による graded confidence（連続）で、昇格（離散）はその決定論キャッシュ。オペレーターの訂正を将来へ効かせる唯一の経路は「再調査→訂正結果を承認」。承認済みは dedup 窓から除外し、再発が即・既知として見えるようにする。
- **参照**: [architecture.md §3](../architecture.md)・[step4-1 §2「学習ループ」](../steps/step4-1-strategy.md)

## ADR-08: デプロイは GCE 常駐 + Cloud Run エッジのハイブリッド

- **決定**: RabbitMQ / MongoDB / Elasticsearch / Valkey / EDA worker は **GCE（常駐 backbone）**、frontend 配信・公開エッジは **Cloud Run（ステートレス）**。
- **理由**: RabbitMQ 常駐 Subscriber は Cloud Run の stateless / scale-to-zero と本質的に噛み合わない。全部 GCE も成立するが、スケールするエッジと常駐の脳を分けるトポロジを採る。
- **参照**: [step4-1 §11.1](../steps/step4-1-strategy.md)・[architecture.md §6](../architecture.md)

## ADR-09: RabbitMQ を維持し、Pub/Sub に替えない

- **決定**: EDA のメッセージバスは RabbitMQ のまま。Cloud Pub/Sub へ置き換えない。
- **理由**: ローカル E2E がフルスタック（docker compose）で決定論に走ることを優先。Pub/Sub 化はローカル再現性を失い、デモ・テストの速度と再現性に対する ROI が合わない。
- **参照**: [step4-1 §11.1](../steps/step4-1-strategy.md)

## ADR-10: Elasticsearch は GCE 自前ホスト

- **決定**: Elastic Cloud でなく GCE backbone に同居させる（heap 512MB に制限）。
- **理由**: 無料クレジット内で賄い外部課金を回避。`SimilarPatternRule` の BM25 検索が用途で、運用/メモリ負担とのトレードオフを許容（逼迫時はマシンタイプを上げる）。未設定時は InMemory Jaccard フォールバックがある。
- **参照**: [step4-1 §11.1](../steps/step4-1-strategy.md)

## ADR-11: Cloud Monitoring webhook 直結・Cloud Function を挟まない

- **決定**: Alerting Policy 発火 → Webhook 通知チャネル → `POST /ingest/cloud-monitoring`（トークン認証）へ直結。中継 Cloud Function は作らない。
- **理由**: 公開 HTTPS は既にあり、中継はホップが増えるだけ。Pub/Sub＋Function によるバッファリング/リトライは「本番 hardening」として線引きし、初手では作らない。
- **参照**: [step4-1 §11.2](../steps/step4-1-strategy.md)

## ADR-12: Valkey を SoT にしない

- **決定**: Valkey は「**再構築可能な read-model projection ＋ SSE fan-out の Pub/Sub transport**」に限定。SoT は Mongo。書き込みは必ず Mongo 先行、読み取りは cache-aside（miss/down は Mongo フォールバック＋再投入）。
- **理由**: Valkey down を「障害」でなく「性能劣化」に縮める。write-through を真実経路にすると in-memory が SoT 化して耐障害性が崩れる。SSE delta は best-effort（liveness 層）で、correctness は reads が担保。
- **参照**: [step4-1 §11.3](../steps/step4-1-strategy.md)

## ADR-13: SSR 不採用・TanStack Query は infrastructure 層に隔離

- **決定**: フロントは CSR＋SSE。TanStack Query を採用するが、依存は frontend の infrastructure 層（API クライアント/フックアダプタ）に閉じ込め、domain/application 層に import しない。
- **理由**: リアルタイムダッシュボードでは SSR の初期描画は直後に SSE で上書きされ旨味が薄い。TanStack はサーバ状態のクライアントキャッシュ＝インフラの関心事であり、ロジックを通信ライブラリ非依存に保つ。
- **参照**: [step4-1 §11.4](../steps/step4-1-strategy.md)

## ADR-14: リアルタイム反映は「SSE push / pull on-demand」の1軸で割る

- **決定**: 小さくて全クライアント共通の「事実」（アラートのライフサイクル・リメディ確定）は SSE push（名前付きイベント多重化）。大きい・外部依存・見ている人だけ要る「詳細」（インフラ証拠）は pull on-demand。証拠の done 判定は SSE で届く alert.status から導出し、status 専用ポーリング API は廃止。
- **理由**: 事象ごとのアドホックな判断を排し、同じ事実を二重に持たない。証拠 broadcast は「1アラート×N クライアントの再収集」事故になる。
- **参照**: [step4-1 §10](../steps/step4-1-strategy.md)

## ADR-15: IaC は WIF キーレス・modules＋単一 prod env・GCS remote state

- **決定**: Terraform は modules＋prod 単一 env＋GCS remote state。CI からの plan/apply は Workload Identity Federation（GitHub OIDC）でキーレス、apply は main＋環境承認ゲート。
- **理由**: 長期 SA キーの排除。2週間スコープで multi-env は過剰。plan/apply の tfstate ロック競合は `concurrency` で直列化。
- **参照**: [step4-1 §11.5](../steps/step4-1-strategy.md)・[architecture.md §6.5](../architecture.md)

## ADR-16: 予測は統計 ML でなく LLM 推論＋引用検証

- **決定**: 予兆（Forecast）は時系列予測・統計 ML を使わず、「既知の未来シグナル（未マージ PR / 未適用 plan / 負荷予定）を過去の記憶と突合する」LLM 推論として構成し、出力の citations を実在シグナル id へ機械照合する。
- **理由**: 統計予測は大量データ前提でデモ規模で成立しない（データ依存を切る）。引用検証（偽引用は破棄・裏付けゼロのリスクは丸ごと破棄）でハルシネーションを構造的に落とす。
- **補足（発火条件・誤読が多い点）**: **過去の記憶は発火の関門ではなくレベルの増幅材**。`ForecastRiskUseCase.run()` が LLM を呼ばないのは主シグナル0件のときだけで、記憶は `collectSignals()` で加算されるのみ＝**前例が無くても未来シグナル単独で予報は出る**（プロンプト規約により原則 LOW〜MEDIUM に留まる）。偽陽性の床は「記憶と join できたものだけ出す」ではなく、(1)裏付けゼロのリスクを表示前に破棄 (2)根拠が1種類なら level を上げない、の2つ。
- **参照**: [step4-1 §7.2–7.3](../steps/step4-1-strategy.md)・[architecture.md §10](../architecture.md)

## ADR-17: join は LLM 委譲・人間は3点の足場に限定

- **決定**: シグナル×記憶の突合（join）を自前ルールエンジンで解かず LLM に委譲する。人間側は (1) 正規化（共通の `subject`/`when`/`desc`）(2) 引用縛り（citations 必須の JSON 契約）(3) 引用検証（実在照合）の3点だけ用意する。
- **理由**: ルールエンジンはブリットルで終わらない。what/when/how の推論はモデルに任せ、人間は「join できる形に整える・引用を強制する・実在を検証する」に限定するのが最小で最強のガード。
- **参照**: [step4-1 §7.3](../steps/step4-1-strategy.md)

## ADR-18: 突合キーは (A)テキストjoin → (B)構造化タグへ段階移行（B 採用）

- **決定**: 記憶側の突合キーは、テキストのまま LLM に意味 join させる (A) でなく、`InvestigationReport` に optional `subject` を持たせ `ForecastMemory` projection で引く (B) を採用。
- **理由**: (A) はブレやすく引用検証が安定しない。(B) は既存 P0 への変更を optional 追記1点に留めつつ精度と検証可能性を得る。
- **参照**: [step4-1 §7.4–7.5](../steps/step4-1-strategy.md)

## ADR-19: 予兆は P0 パイプライン無傷の追加レイヤー・`ForecastSignalSource` の継ぎ目

- **決定**: 予兆は反応的パイプライン（AnalyzeAlert/InvestigateAlert）を一切変更せず、read-only の新規ハンドラとして横に生やす。ハンドラは Gateway を名指しせず `ForecastSignalSource[]` を回し、将来の源追加（event-log 予兆等）を「Source を1個足すだけ」にする。
- **理由**: 既存の安定資産を守りながら能力を追加できる構造自体が拡張性の証明。継ぎ目のコストはほぼゼロ（DI で配列を渡すだけ）で、将来の手戻りを消せる。
- **参照**: [step4-1 §7.5・§7.9](../steps/step4-1-strategy.md)

## ADR-20: 予兆生成は単発 Gemini・ADK 非使用

- **決定**: 調査（ADK 8エージェント）と異なり、予報生成は単発 Gemini（`responseMimeType=application/json` 強制）で行う。
- **理由**: 予兆の入力はハンドラが事前収集済みでツールコール型の自律探索が不要。無人閲覧に耐える構造化出力の堅牢性を優先。シグナル0件なら Gemini 非呼び出し＝課金ゼロ。
- **参照**: [architecture.md §10.3](../architecture.md)

## ADR-21: イベントソーシング基盤は前倒ししない・相関で止め因果推論は将来

- **決定**: 全 DomainEvent を追記ログに貯める基盤と予知ビュー（DDIA unbundling）は将来スコープ（stretchⅢ）とし前倒ししない。予測は「相関の検出」で線引きし、因果推論は研究フロンティアとして将来課題に置く。予知の差別化は予知機構でなく**入力データの質（業務 DomainEvent の粒度）**に置く。
- **理由**: 現行 DomainEvent は薄く障害寄りで、予兆の母集団が足りず前倒ししても価値が出ない。汎用インフラ指標（OTel）はベンダーが横展開できるが、DDD 集約粒度の業務イベントは外部が原理的に作れない内製 moat。ADR-19 の継ぎ目があるため後付けは追加接続で済む。
- **参照**: [step4-1 §7.10](../steps/step4-1-strategy.md)

## ADR-22: プロンプトインジェクションの入力層ガードは意図的見送り

- **決定**: 入力境界での注入分類・遮断（Model Armor / Bedrock Guardrails 相当)は現時点で導入しない。代わりに blast radius をアーキテクチャで絞る: read-only 調査（ADR-05）・write 隔離＋draft PR 人間承認・機密はプロンプト外（Secret Manager）・最小権限のサービス分離・JSON 契約＋引用の実在照合。
- **理由**: 注入が成功しても到達できる範囲が既に構造で制限されており、入力層ガード追加の限界 ROI が低い。限界（注入そのものは遮断しない）は明示し、将来の拡張点として記録する。
- **参照**: [architecture.md §5.5](../architecture.md)

## ADR-23: Cloud Trace API の有効化を意図的見送り

- **決定**: OTel 分散トレースのコード・SA 権限（`roles/cloudtrace.agent`）は用意済みのまま、`cloudtrace.googleapis.com` の API 有効化を見送る。
- **理由**: 現スコープで span 可視化の ROI が低い。ログ↔トレース相関フィールドは出ており、必要になったら bootstrap の services に1行足すだけで復帰できる（復帰手順の明文化とセットの見送り）。
- **参照**: [architecture.md §6](../architecture.md)

## ADR-24: デモシナリオの撤退（在庫競合・旧5/6）

- **決定**: 旧「在庫競合（未知）」シナリオは廃止（2026-07）。旧5「構成変更障害」・旧6「アプリコード退行」は 2026-07-06 にデモ卓から撤退（実装は git 履歴に残置）。現行は 1/2/3/3b/4 の5本。
- **理由**: 在庫競合は実コードに楽観ロック＋指数バックオフが実装済みで、AI の「楽観ロックを導入せよ」推奨と矛盾する（正直さの原則違反）。旧5/6 は検知の入口の説得力が弱く、確度スペクトル（既知→類似→未知）と入力リアルさ3階級は残る5本で過不足なく揃う。自動修正の見送り自体は[個別決定記録](decision-scenario67-remediation-dropped.md)を参照。
- **参照**: [architecture.md §9](../architecture.md)

## ADR-25: `InvestigationReport` は順応者・ACL を挟まない

- **決定**: `AIInvestigationPort` が `AlertAnalysis` 所有の `InvestigationReport` を返すのは境界違反としない（順応者で維持）。ACL・共有カーネル化はしない。`SSEAlertNotifier` は Primitives（契約）依存を維持する。
- **理由**: `AlertAnalysis`/`AIInvestigation` は同一 bounded context（Monitoring）内のモジュールで、依存は一方向・循環なし。AIInvestigation に保護すべき独自内部モデルがなく、ACL は恒等マッピングの儀式コスト。ドメインへ「戻る」データはドメインクラスで受け、外へ「出ていく」データは Primitives で配る。物理分割時に `contracts/*Primitives` を公開言語へ昇格させる継ぎ目は確保済み。
- **参照**: [step4-1 §8.3・§12](../steps/step4-1-strategy.md)

## ADR-26: 空応答 fallback は思考予算を落とした縮退リトライ1回で防御

- **決定**: ADK 調査の最終出力が空/パース不能/runner 例外のとき、コーディネーターの思考予算だけを落とした（min(4096, 設定値)）同一グラフで **1回だけ** 再実行してから fallback（暫定表示）に落とす。再実行は `ai_investigation_retrying` ログで観測可能にする。
- **理由**: 失敗署名（`timedOut=false`・`finalTextLen=0`・最終JSON合成ターンで終了）の機序は「gemini-2.5 系は思考トークンも出力予算を消費するため、証拠が競合する高推論シナリオで思考が予算を食い切り finishReason=MAX_TOKENS・0文字になる」。同条件の盲目リトライは運任せだが、思考↓＝最終JSON用トークン保証↑は機序そのものに効く。分析の質は sub-agent（root_cause_analyst 等）の予算に触れないため保たれ、落ちるのはハブの熟考だけ＝「浅いが完全なレポート ≫ fallback」。上限1回で RabbitMQ prefetch(1) の占有を有界に保つ。
- **恒久策**: 本質は「統括と JSON 化の分離」＝熟考する仕事と JSON を書き出す仕事を同じターンでやらせない。`responseSchema`（構造化出力）は制約付きデコードなので空応答/散文が原理的に出ないが、ツール呼び出しと同一呼び出しで併用不可のため、コーディネーターに直接は付けられない。実装形は2つあった:
  1. **finalizer 方式**: エージェントループ終了後に、ツールなし・思考最小・`responseSchema` 強制の単発 LLM 呼び出しを直列に足し、セッションの調査結果（sub-agent の出力群）を入力に JSON 化だけをやらせる。エージェント数は増えない（グラフ外の直列化ステップ）。
  2. **report_writer サブエージェント方式**: スキーマ強制付き（`outputSchema`＝ツール不要の清書役なので併用制約に当たらない）の sub-agent を作り、コーディネーターに最後に必ず呼ばせる。ランナー側は**コーディネーターの最終テキストではなく、report_writer のツール応答をイベントストリームから直接回収**する（現行の `isFinalResponse` 依存をやめる）。こうするとコーディネーターの最終ターンが空でも無害になる。コーディネーターのプロンプト変更が小さくリスクが低い一方、エージェントが9体になる。
- **恒久策の決定（2026-08-04・実装済み）**: **1（finalizer 方式）を採用**した。当初 2 を退けた理由は「8エージェント」語彙との結合だったが、その制約は解けている（提出物が審査対象でなくなり語彙の更新コストは払える）。それでも 1 を採ったのは**一般解として強いから**——「エージェントを1個足しました」は自作グラフの都合だが、「ADK を本番に置くと踏む問題を、グラフの**外**で構造的に潰した」は他の ADK 利用者にそのまま移せる。
  - 実装: `InvestigationFinalizer`（ポート）／`GeminiInvestigationFinalizer`（ツールなし・`thinkingBudget: 0`・`responseSchema` 強制の単発 `generateContent`）／`finalizerPrompt`（清書役の指示＝調査せず転記のみ・出力スキーマは `SYSTEM_INSTRUCTION` を再利用）／`investigationResponseSchema`（`LLMInvestigationOutput` の出力側の双子。必須フィールドの一致は UT で固定）。ランナーは `getFunctionResponses` でサブエージェントの本文を回収して清書役へ渡す。
  - **既定で毎回走らせる**（`AI_INVESTIGATION_FINALIZER=false` で停止）。「失敗したときだけ清書する」設計にすると fallback の層が1枚増えるだけで、**分離という構造にならない**——分離が常時効いていて初めて空応答の機序が正常系から消える。追加コストはモデル flash・思考0の1呼び出し。
  - **清書は「使える JSON を出したときだけ勝つ」**（`finalizeInvestigationOutput`）。パースを通らなければコーディネーターの下書きへ黙って戻すので、**この段で現行より悪くなり得ない**。採用側は `adk_investigation_run_completed` の `outputSource` で観測する（`finalTextLen=0` かつ `outputSource=finalizer` が「第6原因を恒久策が拾った」実測1件）。
  - **縮退リトライは撤去しない**。finalizer は前段の防御であって置き換えではなく、清書役自体が落ちた場合（Vertex 側の瞬断・タイムアウト）と ADK 調査が例外で死ぬ経路は引き続きリトライが拾う。
  - **実 Vertex での確認済み（2026-08-04・ローカルから1回）**: コーディネーターの最終テキストを**空**にした入力（＝第6原因そのもの）で清書役を呼び、サブエージェント出力群だけから**パース可能な完全なレポートが 2.1 秒で生成**された。同時に確認できたこと——`responseSchema` は Vertex に受理される／citations は `citableIds` の逐語コピーのみ（捏造なし）／`runbook_escalation` の出力が無い入力では `escalation` が**フィールドごと省略**される（宛先の捏造なし）。
  - **未検証**: 本番での `ai_investigation_retrying` 発火回数の低下は**まだ実測していない**（デプロイ後に確認する）。上の1回は「機構が動く」の確認であって「本番で効いた」の測定ではない。
- **参照**: `ADKAgentInvestigationAdapter`（縮退オーケストレーション）・`ADKInvestigationAgentRunner`（サブエージェント出力の回収と清書の直列化）・`finalizeInvestigationOutput`（清書の縮退判断）・`InvestigationCoordinator`（fallback 第4/第6原因の防御コメント）・`BackofficeApp`（finalizer とリトライ用ランナーの配線）

## ADR-27: AI 精度は正診率でなく誤診の検出可能性で設計する（定量評価は未実施）

- **決定**: LLM 出力の**正診率（accuracy）を最適化対象・主張の主軸にしない**。設計変数は「誤診がどれだけ検出可能で、検出後の回復がどれだけ安いか」に置く。実装上その帰結は3つ——(1) 分類（既知一致／類似／未知）を決めるのは LLM でなく決定論（dedup 3層＋Jaccard 語彙一致）で、正しさはテストで固定する。LLM が担うのは**未知と分類された1件の原因推定**のみ。(2) 推定の正しさは運用者の承認/却下を母数にした正答率として常時算出する（`correctCount / withFeedbackCount`、母数 0 は `null`）。(3) 統計的評価（信頼区間・holdout・敵対 eval）は**現時点で未実施**であり、この ADR はその不在を意図的な優先順位付けとして記録する。
- **理由**: 本システムの製品価値は「判定そのもの」ではなく「人間の判断を速くすること」にあり、誤診のコストが非対称——誤診しても却下 → 再調査に戻るだけで、被害が確定しない。ゆえに投資は正診率の底上げ（プロンプト改善・アンサンブル）ではなく、誤診が人間に見えるための機構——確信度キャリブレーション（base 0.4・裏付けで加点・**下げ方向のみの cap**・天井 0.95）、引用の実在照合（未照合も落とさず「未照合」として残す）、承認ゲート、write 系の隔離——へ寄せた。定量評価を提出時点で作らなかったのは、限られた時間で「間違いを検知できる機構」の実装を優先したため。ただし**機構の存在は率の証明ではない**ので、対外的には測定していないことを開示する（誇張しない）。
- **誠実さの実装**: 正答率は必ず母数を併記して表示する（`X/Y 件が正解`／`フィードバック Y 件を母数に算出`）。母数を隠した％を大きく出さない方針から、集計ブロック自体を「学習の軌跡」の従属（`<details>`）に落としている（U5）。
- **既知の測定ギャップ**: `Alert.reopenForReinvestigation()` は再調査を白紙で承認/却下できるよう `feedback` を `null` にクリアする。この結果、**却下 → 再調査を経た事例が分母から消え、正答率が承認側に偏る**。仕様としては意図的（やり直しは二値学習ではない）だが、測定指標としては欠損。数字を語る前にここを直す必要がある。
- **実装案（未着手・優先順）**:
  1. **判定履歴の append 化**（前提条件）: `feedback` を上書き1件で持つ現行に加え、`reviewHistory: { isCorrect, operatorNote, decidedAt, reportRevision }[]` を追記のみで積む。`reopenForReinvestigation` は `feedback` のクリアだけを行い履歴には触れない。分母は履歴側から数えるため却下が消えない。既存 `feedback` は「最新の判定」の射影として残し、`AnalyticsResponse` の集計を履歴ベースへ差し替える。DB は追記フィールドなので後方互換（未設定＝旧データは `feedback` から1件として復元）。
  2. **引用照合率の集計**（最も投資対効果が高い）: `citationRefs` は `AlertContract` の Primitives に永続化済みで、`resolveCitations` が引用と 1:1・件数保存で対応を持つ。したがって「AI が出した引用のうち実在に解決した割合」は**新規の推論実行なしに既存データの集計だけで出せる**。母数がアラート単位でなく**引用単位**なので、少ないアラート数でも統計的に意味のある n を確保できる。これはハルシネーションの間接指標でなく直接測定であり、確信度の `verifiable_cve` 等の強シグナルが実際に効いているかの検証にもなる。出力先は analytics の従属ブロックに1行（`引用 X/Y が実在照合済み`）。
  3. **確信度の単調性検証**: 確信度帯（〜0.5／0.5〜0.75／0.75〜）ごとに承認率を出す。単調に増えていれば「確信度が意味を持つ」ことの実測になり、キャリブレーション設計そのものの検証になる。生の正診率を1つ出すより、当システムの主張に直結する。
  4. **合成 eval ハーネス**（優先度最低）: デモ卓シナリオ（1/2/3/3b/4）は障害を自作しているため正解ラベルが既知で、実 Gemini で N 回流して原因推定の一致を自動採点できる。ただし 5 シナリオ × 数回では n が小さく信頼区間が広い＝数字として弱い。上記 2/3 が先。
- **参照**: `AnalyticsResponse`（正答率の算出）・`AnalyticsPage`（母数併記・従属化）・`Alert.reopenForReinvestigation`（測定ギャップ）・`CitationResolution`（引用照合の 1:1 対応）・`ConfidenceCalibration`（下げ方向のみの cap）・[ADR-05](#adr-05-調査readと修正writeの構造分離人間承認ゲート)（承認ゲート）・[ADR-07](#adr-07-学習は承認のみ昇格は学習でなく結晶化)（学習＝承認のみ）
