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
| [ADR-28](#adr-28-予報は追記型で永続化する最新1件のオンメモリ保持をやめる) | 予報は追記型で永続化・リセットは soft discard | 予兆 |
| [ADR-29](#adr-29-判定は上書きの状態と追記の事実に分ける正答率の母数は履歴から数える) | 判定＝状態と事実に分離・母数は履歴から | 学習 |
| [ADR-30](#adr-30-引用照合率は引用単位で数えゲートを通った引用は母数に入れない) | 引用照合率＝引用単位・ゲート通過分は除外 | AI |
| [ADR-31](#adr-31-予報の測定は率ではなく落とした件数で出し導けるものは保存しない) | 予報の測定＝破棄の件数・導けるものは保存しない | 予兆 |
| [ADR-32](#adr-32-予報に確信度は表示しない較正できない自己申告を決定論で出せている軸に重ねない) | 予報の確信度%は表示しない | 予兆 |
| [ADR-33](#adr-33-予報は-pr-コメントで届けるgate-にはせず該当は引用一致を第一根拠にする) | 予報を PR コメントで提示・gate にしない | 予兆 |

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
- **既知の測定ギャップ（→ 2026-08-04 に解消・[ADR-29](#adr-29-判定は上書きの状態と追記の事実に分ける正答率の母数は履歴から数える)）**: `Alert.reopenForReinvestigation()` は再調査を白紙で承認/却下できるよう `feedback` を `null` にクリアする。この結果、**却下 → 再調査を経た事例が分母から消え、正答率が承認側に偏る**。仕様としては意図的（やり直しは二値学習ではない）だが、測定指標としては欠損だった。判定履歴（`reviewHistory`）を追記で持ち、母数をそちらから数えることで解消済み。
- **実装案（未着手・優先順）**:
  1. **判定履歴の append 化**（前提条件・**2026-08-04 実施済み → [ADR-29](#adr-29-判定は上書きの状態と追記の事実に分ける正答率の母数は履歴から数える)**）: `feedback` を上書き1件で持つ現行に加え、`reviewHistory: { isCorrect, operatorNote, decidedAt, reportRevision }[]` を追記のみで積む。`reopenForReinvestigation` は `feedback` のクリアだけを行い履歴には触れない。分母は履歴側から数えるため却下が消えない。既存 `feedback` は「最新の判定」の射影として残し、`AnalyticsResponse` の集計を履歴ベースへ差し替える。DB は追記フィールドなので後方互換（未設定＝旧データは `feedback` から1件として復元）。
  2. **引用照合率の集計**（最も投資対効果が高い・**2026-08-04 実施済み → [ADR-30](#adr-30-引用照合率は引用単位で数えゲートを通った引用は母数に入れない)**）: `citationRefs` は `AlertContract` の Primitives に永続化済みで、`resolveCitations` が引用と 1:1・件数保存で対応を持つ。したがって「AI が出した引用のうち実在に解決した割合」は**新規の推論実行なしに既存データの集計だけで出せる**。母数がアラート単位でなく**引用単位**なので、少ないアラート数でも統計的に意味のある n を確保できる。これはハルシネーションの間接指標でなく直接測定であり、確信度の `verifiable_cve` 等の強シグナルが実際に効いているかの検証にもなる。出力先は analytics の従属ブロックに1行（`引用 X/Y が実在照合済み`）。
  3. **確信度の単調性検証**: 確信度帯（〜0.5／0.5〜0.75／0.75〜）ごとに承認率を出す。単調に増えていれば「確信度が意味を持つ」ことの実測になり、キャリブレーション設計そのものの検証になる。生の正診率を1つ出すより、当システムの主張に直結する。
  4. **合成 eval ハーネス**（優先度最低）: デモ卓シナリオ（1/2/3/3b/4）は障害を自作しているため正解ラベルが既知で、実 Gemini で N 回流して原因推定の一致を自動採点できる。ただし 5 シナリオ × 数回では n が小さく信頼区間が広い＝数字として弱い。上記 2/3 が先。
- **参照**: `AnalyticsResponse`（正答率の算出）・`AnalyticsPage`（母数併記・従属化）・`Alert.reopenForReinvestigation`（測定ギャップ）・`CitationResolution`（引用照合の 1:1 対応）・`ConfidenceCalibration`（下げ方向のみの cap）・[ADR-05](#adr-05-調査readと修正writeの構造分離人間承認ゲート)（承認ゲート）・[ADR-07](#adr-07-学習は承認のみ昇格は学習でなく結晶化)（学習＝承認のみ）

## ADR-28: 予報は追記型で永続化する（最新1件のオンメモリ保持をやめる）

- **決定**: `RiskForecast`（`ForecastBriefing`）を Mongo の `risk_forecasts` へ**生成のたびに1件 insert** する。読み取りは従来どおり**最新1件だけ**（`GET /forecast` の挙動・ワイヤの形は不変）。`DELETE /forecast`（デモ卓のリセット・F12）は行を消さず `discardedAt` を立てる **soft discard** とし、読み取り対象から外すだけにする。ストアの種類は増やさない（edge/worker が既に共有している Mongo に相乗り）。
- **理由**: 従来の `InMemoryRiskForecastRepository` は単一プロセスの最新1件のみを保持していた。帰結が2つある。(1) **消える**——Cloud Run edge の再起動・インスタンス増減で、生成した個体と `GET` を受けた個体が違えば 404 に落ちる。これは terraform 証拠が `edge/worker × InMemory` で欠落した事故と**同型の負債**。(2) **測れない**——予報の level 分布・偽引用の破棄件数は「過去に何を出したか」の標本を要求するが、上書き保存では母数が常に 1。本番で回った回数の痕跡は Cloud Logging だけで、`forecast_generated` は `horizon / signals / risks / isFallback` しか持たず**生き残ったリスクの level はログにも無い**（level が出るのは破棄側の `forecast_uncited_risk_dropped` だけ＝非対称）。**測定の標本は、保存の形で決まる。**
- **soft discard にした理由**: 追記にしておきながら、デモ卓のリセット1回で履歴が消えるなら追記の意味が無い。「未生成状態に戻す」は**配信の話**であって履歴の話ではないので、両者を別の軸として分けた。`DELETE /forecast` がアラート側 `/demo/reset` に相乗りしないという既存の判断（温めた予報キャッシュを巻き込まない）とも同じ方向。
- **検証カウンタは同じドキュメントに載せる**: 引用の破棄件数・level 分布といった測定値のために別コレクションを作らない。ストアは `RiskForecast` の射影（`Date` だけ ISO 文字列化）として組んであり、**`RiskForecast` に追記されたフィールドはマッピングを書き足さずに同じ doc へ載る**。
- **参照**: `MongoRiskForecastRepository`・`RiskForecastRepository`（`append` / `findLatest` / `clear`）・`ForecastRiskUseCase.verifyRisk`（破棄の発生点）・[ADR-27](#adr-27-ai-精度は正診率でなく誤診の検出可能性で設計する定量評価は未実施)（測定の方針）

## ADR-29: 判定は「上書きの状態」と「追記の事実」に分ける（正答率の母数は履歴から数える）

- **決定**: `Alert` に `reviewHistory: ReviewRecord[]` を**追記のみ**で持たせ、`AnalyticsResponse` の正答率の母数（`withFeedbackCount`）をそちらから数える。`feedback` は**「最新の判定」という状態の射影**として残し、`reopenForReinvestigation()` が白紙に戻すのはこの射影だけ——履歴には触れない。`ReviewRecord` は **AI の採点（`isCorrect`）と人間の決裁（`decision` = `acted` / `deferred` / `rejected`）を別フィールド**で持ち、どの版のレポートに対する判定かを `reportRevision` で刻む。旧データ（`reviewHistory` 未保存）は読み出し時に `feedback` から1件復元する＝追記フィールドなのでマイグレーション不要。
- **理由**: [ADR-27](#adr-27-ai-精度は正診率でなく誤診の検出可能性で設計する定量評価は未実施) が「既知の測定ギャップ」として記録していた欠損の解消。**やり直しは状態を戻す操作であって、判定したという事実を消す操作ではない。** 両者を1つのフィールドに載せていたため、却下 → 再調査 → 承認 が `1/1` に縮み、正答率が承認側に偏っていた。`feedback` を残したのは、UI・SSE 契約・既存テストへの波及をゼロに保つためだけでなく、ドメインの意味としても「いまこの Alert がどう判定されているか」は履歴とは別概念だから。**分母の設計は後から変えると壊れる**ので、フィールドを足すならこのタイミングしかない。
- **`isCorrect` と `decision` を分けた理由**: 同じレコードに見えて主語が違う。`isCorrect` の主語は AI（診断が当たっていたか）、`decision` の主語は人間（それを受けて何を選んだか）。**`isCorrect` だけの台帳は「AI の採点表」になる**——採点表は、AI が正しく人間が誤っていた記録が積み上がった時点で組織内で政治的に殺される。`decision` を一級市民として持つと同じデータが決裁台帳になり、見送りが「不作為」ではなく「理由のある決裁」として残る。実装上の判定基準は「**`isCorrect: true` かつ `decision: deferred`（診断は正しいが対処は見送った）が表現できるか**」——これが表現できないなら分割が失敗している。
- **母数は「判定の回数」で数える（Alert 単位ではない）**: 却下 → 再調査 → 承認 は 1/2。同じレポートに対する判定のやり直し（誤承認の訂正）も 2 件として数える——判定は判定だから。ただし各エントリが `reportRevision` を持つので、**「同一版への複数判定を1件に畳む」数え方へ後から切り替えられる**（保存済みデータを変えずに集計側だけ差し替えられる形にしてある）。数え方を確定させるより、数え直せる形で保存することを優先した。
- **推測値に印を付ける**: `decisionSource`（`operator` / `derived`）を持つ。現行 UI は承認/却下の二値しか送らないので、`decision` 未指定の判定は `isCorrect` から導出した暫定値として `derived` で記録する（旧データからの復元も同じ。`decidedAt` は復元できないので `null`）。**「人が押した」と「こちらが導出した」が区別できないと、母数の話ができない**——母数を語るための機能なので、ここを曖昧にすると目的を外す。
- **母数を実装変更で動かさない**: 履歴が空でありながら `feedback` だけがある Alert は、履歴を持たなかった頃のデータ（およびデモ seed の埋め込み判定）として `feedback` から1件復元する。ここを空のままにすると、**表示中の正答率が実装変更だけで縮む**。⚠ 帰結として、**seed が埋め込んだ承認は引き続き母数に入る**（`decisionSource=derived` / `decidedAt=null` で区別は付く）。これは E1 の担当範囲ではなく、seed 由来の判定を人間の判定と分けて数えるかは別の決定。
- **やらないこと（この ADR の範囲外）**: ハッシュチェーンによる改ざん検知（`prevHash`）は継ぎ目だけ残して実装しない（v2.5 M3）。UI から `decision` を選ばせる導線・決裁台帳としての集計も作らない（v2.5 D1/D2）。API（`PATCH /alerts/:id/feedback`）は `decision` を受け取れるが、想定外の値は**未指定に畳む**（捏造された決裁を台帳に入れない）。
- **参照**: `Alert.reviewHistory` / `Alert.submitFeedback` / `Alert.reopenForReinvestigation`・`AnalyticsResponse`（母数の算出）・`AlertContract`（`ReviewRecordPrimitives` の単一ソース）・`AlertFeedbackPatchController`（`decision` の受け口）・[ADR-27](#adr-27-ai-精度は正診率でなく誤診の検出可能性で設計する定量評価は未実施)（測定の方針・解消したギャップ）・[ADR-07](#adr-07-学習は承認のみ昇格は学習でなく結晶化)（学習＝承認のみ）

## ADR-30: 引用照合率は「引用単位」で数え、ゲートを通った引用は母数に入れない

- **決定**: 「AI が出した引用のうち実在に解決した割合」を `AnalyticsResponse.citationCoverage` として常時算出する（`buildCitationCoverage`）。**母数はアラート単位でなく引用単位**。数えるのは **`impact.citations` と `escalation.evidenceBundle` だけ**で、`relatedAlerts[].citations`（J1 ゲート通過後）と `remediationReview.citations`（照合結果を持たない）は入れない。未照合の引用は**分子から外し分母には残す**。照合結果そのものが未保存の旧データは「解決しなかった」ではなく「**測っていない**」として分母にも分子にも入れず、`unmeasured` として件数だけ残す。表示は analytics の従属ブロックに1行（`引用 X/Y が実在照合済み`＋種別内訳）で、**％は持たせない**。
- **理由**: 新規の推論をひとつも実行せずに出せる**ハルシネーションの直接測定**だから。引用単位にするのは、アラート単位だと n がアラート数で頭打ちになり（本番で10件程度）何も言えないため——1アラートが複数の n を生む。`relatedAlerts` を除いたのが数え方の芯で、**あれはゲート（解決しない引用を除去し、ゼロになった関連を破棄）を通った後なので定義上 100%**。分子に混ぜれば率は自動的に上がるが、その上がり方には情報が無い。**測るなら、落とす前のものを測る。**
- **実測（2026-08-04・本番 Alert 10 件）**: `9/9`・内訳 terraform 4 / cve 2 / event 2 / metric 1・未照合 0・`unmeasured` 0。⚠ **n=9 で 100% は「情報量がほぼゼロ」**＝母数を隠した％を出さない方針の当然の帰結として、**この数字を単独の主張として大きく出さない**（測ったこと自体は開示する）。
- **この率が含まないもの（正直さの限界）**: `guardImpact` は**引用がゼロの impact を表示・永続化の前に丸ごと落とす**。したがって分母に入るのは「引用を1つ以上出した影響評価」だけで、**根拠ゼロの主張は測定対象に入っていない**。同様に J1 で破棄された相関も入らない。破棄側は永続化前に消えるので既存データからは遡れない——数えるならカウンタを追加する必要がある（[ADR-28](#adr-28-予報は追記型で永続化する最新1件のオンメモリ保持をやめる) が予報側で通ったのと同じ道）。**「照合率100%」は「ハルシネーションが無い」ではなく「残った引用は全部実在した」**であり、この2つを言い換えない。
- **種別内訳を出す目的**: 率の高さの誇示ではなく、確信度キャリブレーションの強シグナル（`verifiable_cve` 等）が実際に効いているかの検証。種別ごとに割れていれば重み付けが実測で裏づけられる（あるいは反証される）。
- **参照**: `CitationCoverage`（集計の純関数）・`CitationResolution`（引用と 1:1・件数保存の照合）・`InvestigationReportMapper.guardImpact` / `guardRelatedAlerts`（落とす側＝この率に入らない）・`AnalyticsPage`（母数併記・従属ブロック）・[ADR-27](#adr-27-ai-精度は正診率でなく誤診の検出可能性で設計する定量評価は未実施)（測定の方針）

## ADR-31: 予報の測定は「率」ではなく「落とした件数」で出し、導けるものは保存しない

- **決定**: 予報側の測定（E6）を診断側（[ADR-30](#adr-30-引用照合率は引用単位で数えゲートを通った引用は母数に入れない)）と**別の指標・別のフィールド・別の表示ブロック**にする。`RiskForecast` に追記するのは**引用検証の破棄カウンタ4つだけ**（`citationsEmitted` / `citationsDropped` / `risksEmitted` / `risksDropped`）。level 分布・シグナルの kind 別内訳・MEMORY 引用の有無は**保存せず、保存済みブリーフィングから読み取り時に数え直す**。`GET /analytics` は `forecastMeasurement` という**独立したフィールド**で返し、`AnalyticsResponse` には入れない。
- **率にしない理由**: `verifyRisk()` は実在しない引用を**永続化の前に**落とすので、保存済み予報の引用照合率は**定義上 100%**。集計しても情報がゼロで、しかも診断側の率と並べると予報側の 100% が診断側の率まで信用させなくする。**測るのは残った側ではなく落とした側**で、落とした側は率にならない（分母が「LLM が出した引用」なので、率にすると「機構がどれだけ働いたか」ではなく「LLM がどれだけ間違えたか」の指標に変わる）。同じ理由で表示は診断側と別ブロックに置く。
- **保存するのは「消えるもの」だけ**: 4つのカウンタは `verifyCitations()` のローカル変数で、外に出るのは整形済み warn 文字列だけ＝**保存しなければ消える**。一方 level 分布・kind 内訳・MEMORY 引用の有無は、`ForecastBriefing` が**リスクとシグナルを両方同梱して保存している**ので後から必ず導ける。導けるものを保存すると (1) 同じ事実の出所が2つになり (2) **数え方を変えたときに過去の標本へ遡って効かなくなる**。測定の定義は今後変わる前提なので、数え直せる形を優先した（→ v2 todo E6-3 が「同じ追記フィールドに載せる」と書いていた部分は、この理由で**読み取り時の集計**に変えている）。
- **標本は `discardedAt` を無視した全行**: `findAll()` は破棄済みの行も返す。破棄（`DELETE /forecast`）は「未生成状態に戻す」＝**配信の話**であって履歴の話ではないので、ここで除くとデモ卓のリセット1回で level 分布も破棄件数も消え、[ADR-28](#adr-28-予報は追記型で永続化する最新1件のオンメモリ保持をやめる) で追記型にした意味が無くなる。
- **除外を3つに割る**: 集計から外すのは (1) `isFallback`＝生成失敗の縮退 (2) シグナル0件＝ **LLM を呼んでいない**空予報 (3) 検証カウンタ未保存＝ E6-1 以前のデータ、の3種で、**それぞれ件数を併記する**。3つとも「破棄0件」と同じ 0 に見えるが、原因が「答えなかった」「呼ばなかった」「測っていなかった」で全く違う。[ADR-30](#adr-30-引用照合率は引用単位で数えゲートを通った引用は母数に入れない) の `unmeasured` と同じ流儀。**破棄が0でも表示は消さない**——「機構が要らなかった」ではなく「まだ発火していない」なので隠さない。
- **level 分布は MEMORY 引用の有無で割る**: 偽陽性の床は「出さない」ではなく **「弱く出す」** の形をしている（裏付けが1系統なら LOW〜MEDIUM 止まり）。したがって「**前例が無くても出る。ただし弱く出る**」を実測で言うには、level × 前例の有無の2軸が要る。判定は**引用 id を同梱シグナルへ解決して `kind` を見る**（採番規則 `inc-*` の綴りに依存しない）。
- **有効リードタイムの対処所要は「宣言値」**（`DECLARED_REMEDIATION_MINUTES = 30`・`effectiveLeadTime`）。クラスで割らないのは、プール上限の引き上げも VM の machine_type 変更も Valkey のメモリ変更も**手順が「merge → 手動承認 → terraform apply」の1本**だから——経路が同じものにクラス別の数字を立てると、根拠の無い差を作ることになる。**予測発生時刻は関数の引数**（`RiskItem.window` が LLM 由来の自由文字列なので機械的に引けない）＝当面は人手の注記で、`windowAt?: Date` への構造化は**予報が2桁に達してから**。差し引きが負なら**0 に丸めず負のまま返す**——負であること自体が「その予報クラスは的中しても価値がない」という結論だから。表示には必ず「宣言値」と書く（実測を装わない）。
- **参照**: `ForecastMeasurement`（読み取り時の集計）・`riskLevelBreakdown`（level × MEMORY 引用の判定・ログと集計の単一ソース）・`ForecastRiskUseCase.verifyCitations`（破棄の発生点＝カウンタの出所）・`remediationLeadTime`（宣言値と有効リードタイム）・`RiskForecastRepository.findAll`（標本の定義）・`AnalyticsGetController`（診断側と混ぜない合成点）・[ADR-27](#adr-27-ai-精度は正診率でなく誤診の検出可能性で設計する定量評価は未実施)（測定の方針）

## ADR-32: 予報に確信度は表示しない（較正できない自己申告を、決定論で出せている軸に重ねない）

- **決定**: 予兆リスクカードから **confidence の表示を撤去**する（`RiskCard` の `ConfidenceBar` と `ConvergenceMiniFlow` 結論ノードの「確信度 N%」の2箇所）。**値は wire・永続化・表示順の tiebreak には残す**——LLM が何と言ったかは追記型の履歴に記録し続ける。消すのは画面だけ。
- **理由（3つ・重い順）**:
  1. **同じ軸を二重に出していた。** `GeminiForecastAdapter` のプロンプトは level も confidence も同じ材料（「独立した種類の根拠が同一 subject でどれだけ重なったか」）で決めさせており、ソートも level 降順 → confidence 降順の tiebreak。そして**その軸はカード上に既に決定論で載っている**——「根拠 N種類」チップと収束ミニフローのレーン件数は `citations` を `kind` でグルーピングして数えた値で、**盛る経路が構造的に無い**。confidence はその劣化コピーだった。
  2. **担保の強さが違うのに、同じ画面言語で出していた。** 診断側は `ConfidenceCalibration`（base cap 0.4・検証可能な裏付けで加点・**下げるだけ**・天井 0.95）を通し、`CalibratedConfidence` の署名UIで「どのシグナルで cap がいくつになったか」を開ける。予報側は `clampConfidence` で 0〜1 に丸めるだけ・由来を開く導線ゼロ。同じ cyan の％で並ぶと、**担保のある数字と無い数字が見分けられない**。
  3. **自分の規律に自分で違反していた。** 「母数を隠した％を大きく出さない」は analytics 側では徹底している（[ADR-30](#adr-30-引用照合率は引用単位で数えゲートを通った引用は母数に入れない) も [ADR-31](#adr-31-予報の測定は率ではなく落とした件数で出し導けるものは保存しない) も率をやめて件数にした）のに、予報カードだけ未較正の％が2箇所に大書きされていた。
- **較正を足す案を採らなかった理由**: 予報側には診断側のような検証可能な裏付けシグナル（既知パターン一致・引用コミット・Terraform 差分・実在 CVE）が無い。使える材料は「引用シグナルの kind が何種類あるか」だけで、**較正を作っても結局その決定論値の写像**にしかならない。同じ情報を2つの数字で言うより、数字を1つ減らすほうが正しい。
- **帰結**: 質疑での自己開示「**cap は診断側だけ・予報側は較正していない**」が、「**予報側には確信度を出していない。較正できない数字は出さない、という同じ規律**」に変わる＝弱点の開示から規律の実演へ。⚠ ただし**収録済みのデモ動画には確信度%が映っている**（撤去前の収録）ので、指摘されたらその旨を即答する。
- **参照**: `RiskCard` / `ConvergenceMiniFlow`（撤去した2箇所）・`GeminiForecastAdapter.SYSTEM_INSTRUCTION`（level と confidence が同じ材料である根拠）・`citationKindCount` / `convergenceLanes`（残した決定論値）・`ConfidenceCalibration` / `CalibratedConfidence`（診断側の担保＝比較対象）・[ADR-16](#adr-16-予測は統計-ml-でなく-llm-推論引用検証)（予測は LLM 推論＋引用検証）

## ADR-33: 予報は PR コメントで届ける（gate にはせず、該当は「引用一致」を第一根拠にする）

- **決定**: 予報を**リリース判定の場（GitHub PR）へ自動で提示する**入口を1つ作る（`forecast-pr-comment.yml` → `GET /forecast` → 該当があればコメント1枚）。**止める権限は持たせない**——`exit code` で落とす経路も、必須チェックにする設定も入れない。該当の判定は2本立てで、**(1) その PR を予報が根拠として引用しているか**（強）→ **(2) PR の突合キーと `risk.subject` のトークン照合**（弱）の順に見る。**決めた記録（`decision` 台帳）はここでは作らない。**
- **理由（提示側）**: 意思決定支援の成功の独立予測因子は「① ワークフローの中で自動的に提示される」「③ 意思決定の時と場所で提示される」であって精度ではない（[Kawamoto et al. 2005, BMJ 330:765](https://pubmed.ncbi.nlm.nih.gov/15767266/)）。`GET /forecast` を人が見に行く pull 型は①③を満たさない。**CI から引けるだけでも満たさない**——引いた結果が決裁の場に出ないなら、見に行く先が増えただけ。
- **gate にしない理由**: 形式的な外部承認プロセス（CAB）は変更失敗率の低下と結びつくという証拠が見つかっておらず、配信速度とバッチサイズを悪化させる（[DORA / 2019 State of DevOps](https://dora.dev/capabilities/streamlining-change-approval/)）。語彙も揃える——「リリース**認可の条件**に置く」とは言わず「既にあるレビューと自動チェックに**材料**を届ける」と書く。中身が推奨側でも語彙が否定されている側だと逆評価になる。**止めないから記録が残り、記録が残るから後で評価できる。**
- **「引用一致」を第一根拠にした理由（実測で判明）**: 本番予報（2026-08-04）の `risk.subject` は terraform アドレス `module_gce_backbone_google_compute_instance_backbone` で、それを引用している PR#55 のタイトルは「cap Mongo connection pool ...」。共有トークンは `backbone` の1語だけで `subjectsMatch` の閾値（2語）に届かず、**予報が根拠にした当の PR にコメントが出ない**という捻れが起きていた。引用は予報側が既に突合し引用検証（実在しない id の破棄）まで通した結果なので、**タイトルの語の重なりより強い**。順序も level より引用一致を先に見る——「この PR を根拠に出た予報」のほうが、この PR の決裁に効く。**どちらで当たったかはコメント本文にも書く**（なぜこの PR に出ているのかを読み手が検算できる形にする）。
- **該当が無ければ出さない**: 毎 PR にコメントを出すと `deferred` がゴム印になり、台帳は「決裁の証跡」ではなく「無視の証跡」になる（同分野の実測でアラートの平均オーバーライド率は 46.2〜96.2%・1件増えるごとに受容確率が約30%低下）。決裁台帳を作る**前に**、最低限の提示頻度の抑制だけ入れてある。同じ PR にも積まず、目印付きの既存コメントを更新する。
- **有効リードタイムの予測発生時刻は「人手の注記」で受ける**: `window` は LLM 由来の自由文字列で機械的に引けない。注記が無ければ**推定せず、算出していない旨を書く**（[ADR-31](#adr-31-予報の測定は率ではなく落とした件数で出し導けるものは保存しない) の「測っていない」と「0」を混ぜない扱いと同じ）。構造化は予報が2桁に達してから。
- **表示の語彙は予報カードから借りる**: 見出しは `window`・「根拠 N種類」は2種類以上のときだけ・「今打てる先手」はフィールドが無ければブロックごと消える。⚠ **確信度%は載せない**（[ADR-32](#adr-32-予報に確信度は表示しない較正できない自己申告を決定論で出せている軸に重ねない)）。
- **範囲の線引き（外向きに言うときの正確さ）**: 立ったのは**提示（①③）だけ**で、却下が記録として蓄積される場所はまだ無い。「決裁に組み込んだ」「4因子を持った」とは言わない。
- **参照**: `pullRequestForecastComment`（判定と本文・純関数）・`src/apps/ci/forecast-pr-comment/main.ts`（取得と出力・**常に exit 0**）・`.github/workflows/forecast-pr-comment.yml`・`remediationLeadTime`（有効リードタイム）・`PullRequestSignalSource`（`github.pr#N` の source 規約＝引用一致の契約）・[ADR-16](#adr-16-予測は統計-ml-でなく-llm-推論引用検証)（引用検証）
