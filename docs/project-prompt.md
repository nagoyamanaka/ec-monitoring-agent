# 設計エージェント向けプロンプト v11

> **変更履歴（v10→v11）**
> AlertClassifier の実装段階戦略（InMemory完全一致 → Elasticスコアリング → A2A統合）を確定。
> 各ステップの完了条件・依存関係・提出安全ラインを明記。
> Elastic Cloud の費用試算・選定基準を追記。
> Step 5 ADR 項目に1件追加。
>
> | Step                                       | 詳細設計ドキュメント                | ステータス      |
> | ------------------------------------------ | ----------------------------------- | --------------- |
> | Step 1: ディレクトリ構成                   | `docs/step1-directory-structure.md` | ✅ 確定         |
> | Step 2: ドメインモデル設計（EC）           | `docs/step2-domain-model.md`        | ✅ 確定         |
> | Step 3: アプリケーション層設計（EC）       | `docs/step3-application-layer.md`   | ✅ 確定         |
> | Step 4: Monitoringコンテキスト拡張ポイント | `docs/step4-monitoring-context.md`  | ✅ 確定         |
> | Step 5: ADR                                | `docs/step5-adr.md`                 | 🔲 次のステップ |

---

## あなたの役割

あなたはシニアソフトウェアアーキテクトです。
以下のコンテキストと制約を読み込み、設計フェーズのアウトプットを順番に生成してください。
実装コードは出力しないでください。設計が確定してから別セッションで行います。

---

## プロジェクト概要

### 目的

ECドメイン（注文・在庫）で発生する障害を、AIエージェントがリアルタイムに分析・分類し、バックオフィスダッシュボードへレポートするシステム。

### ハッカソン要件（必須）

- Google Cloud アプリケーションプロダクトを1つ以上使用（Compute Engine採用）
- Google Cloud AI技術を使用（**Gemini API必須**。Claude/GPT-4は使用禁止）
- Findy DevOps × AI Agent Hackathon 2026 出展用

### ハッカソンGCP要件の充足戦略

**要件1（アプリ実行）**: Compute Engine（e2-medium × 1）で充足。選択肢に明示されており完全適合。

**要件2（AI技術）**: 以下の3フェーズで段階強化する。

| フェーズ                    | 実装                                          | 充足状況                                      | 備考                         |
| --------------------------- | --------------------------------------------- | --------------------------------------------- | ---------------------------- |
| ハッカソン本体              | Gemini API直接（`@google/generative-ai`）     | ✅ Gemini API                                 | 要件最低ラインを確実に満たす |
| フェーズ1（完成後）         | Vertex AI SDK経由（`@google-cloud/vertexai`） | ✅✅ Gemini API（Vertex AI推奨経路）          | 審査員評価が上がる           |
| フェーズ2（ポートフォリオ） | ADKエージェント構成                           | ✅✅✅ Gemini Enterprise Agent Platform + ADK | 2項目達成                    |

> **重要**: 各フェーズの切り替えは `AIInvestigationPort` 実装クラスのDI差し替えのみ。
> `InvestigateAlertCommandHandler`（Application層）は完全にノータッチ。

### ポートフォリオ要件

- 6年目フルスタックエンジニアの転職ポートフォリオとしても機能させる
- 「設計から運用まで考えられるエンジニア」を証明するアウトプットにする

---

## 参照リポジトリ（設計の規約・パターンの拠り所）

**CodelyTV typescript-ddd-example**
URL: https://github.com/CodelyTV/typescript-ddd-example

このリポジトリをクローンまたはブラウズし、以下のパターンを必ず踏襲すること。

### 参照すべき構造・規約

```
src/
├── Contexts/
│   ├── Shared/
│   │   ├── domain/
│   │   │   ├── AggregateRoot.ts       ← 必ず継承元として使用
│   │   │   ├── DomainEvent.ts         ← イベントの基底クラス
│   │   │   ├── EventBus.ts            ← インターフェース定義
│   │   │   ├── ValueObject/           ← Value Objectの基底
│   │   │   └── criteria/              ← 検索条件の抽象化（そのまま流用）
│   │   └── infrastructure/
│   │       ├── EventBus/RabbitMq/
│   │       └── persistence/criteria/
│   ├── Mooc/                          ← ECコンテキストの参考元
│   └── Backoffice/                    ← Monitoringバックオフィスの参考元
└── apps/
    ├── mooc/backend/
    └── backoffice/backend/
```

### 踏襲するパターン（コードを読んで確認すること）

1. **AggregateRoot**: `record()` でDomainEventを蓄積し、`pullDomainEvents()` で取り出す
1. **DomainEvent**: `EVENT_NAME`静的プロパティ、`fromPrimitives()` / `toPrimitives()` を必ず実装
1. **Value Object**: プリミティブをラップ、イコール比較を持つ
1. **ApplicationService**: メソッド名は `run()` で統一（CodelyTV準拠）
1. **CommandHandler**: `CommandHandler<T>` インターフェースを実装
1. **Repository**: インターフェースをdomainに、実装をinfrastructureに配置
1. **RabbitMQ**: Subscriber登録、Queue命名規則（`{appName}.{eventName}.{subscriberName}`）、Failover Publisher
1. **DI**: `node-dependency-injection` + YAMLファイルによる設定（ハッカソンスコープでは後回しにしてよい。ただし差し替えやすい構造にしておくこと）

---

## 技術スタック

| カテゴリ       | 技術                                                                               | 備考                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Language       | TypeScript                                                                         | Strict mode                                                                                                      |
| Framework      | Express.js                                                                         | バックエンドAPI                                                                                                  |
| Frontend       | React（CSR）                                                                       | バックオフィスUI。SSR/ISR不使用                                                                                  |
| Architecture   | DDD + CleanArchitecture + CQRS + EDA                                               | CodelyTVパターン準拠                                                                                             |
| Message Broker | RabbitMQ                                                                           | DomainEvent配信                                                                                                  |
| Database       | MongoDB                                                                            | 全コンテキスト統一（ハッカソンスコープ）                                                                         |
| AI（現行）     | Gemini API                                                                         | `@google/generative-ai`。ハッカソン本体で使用                                                                    |
| AI（将来P1）   | Vertex AI SDK                                                                      | `@google-cloud/vertexai`。フェーズ1で差し替え                                                                    |
| AI（将来P2）   | ADK（Agents Development Kit）                                                      | フェーズ2でマルチエージェント構成                                                                                |
| 検索（将来P1） | Elasticsearch（Elastic Cloud）                                                     | `ElasticAlertClassifier` でStrategyに追加。Elastic Agent Builder + A2AはP2                                       |
| Observability  | Cloud Logging・Cloud Monitoring・Cloud Trace                                       | GCPネイティブ。OTel SDK（`@opentelemetry/sdk-node`）からGCPエクスポーター経由で直接送信。Collectorコンテナ不使用 |
| Logging        | OTel Logs → Cloud Logging（`@google-cloud/opentelemetry-cloud-trace-exporter` 等） | Winston不使用。OTel一括化でtrace_id自動付与                                                                      |
| Test           | Vitest (BDD)                                                                       |                                                                                                                  |
| Infra          | GCP Compute Engine (e2-medium × 1)                                                 |                                                                                                                  |

### MongoDBに統一する設計判断の根拠（面接時の説明用）

- MonitoringイベントとAI分析結果はスキーマが可変 → MongoDBが自然
- ECドメインは本来PostgreSQLが適切（ACID整合性）。ハッカソンスコープで統一し、整合性はアプリケーション層で担保する
- 実装時間の最適化と将来的な拡張性のトレードオフを意識した選択

### PostgreSQL段階的移行への設計上の配慮（必須）

- `OrderRepository` / `InventoryRepository` インターフェースをDomain層に置き、MongoDB実装とPostgreSQL実装を差し替え可能にする
- MongoDB依存の型・クエリをInfrastructure層に完全に閉じ込め、Domain層に漏らさない
- ADR（Step 5）にPostgreSQL移行のトリガー条件を明記すること

### 在庫管理の厳密性に関するトレードオフ（面接時の説明用）

**現在の設計方針（ハッカソンスコープ）**

在庫引き当ては All-or-Nothing（全商品成功か全商品失敗）を原則とし、2フェーズ方式（事前チェック＋楽観ロック＋補償）で実現する。詳細は `docs/step3-application-layer.md` を参照。

**在庫引き当て戦略ロードマップ**

| フェーズ   | 実装                                          | 前提条件・移行トリガー                                    |
| ---------- | --------------------------------------------- | --------------------------------------------------------- |
| ハッカソン | 事前チェック＋楽観ロック＋補償（MongoDB単体） | ReplicaSetなし、低競合                                    |
| 中期       | MongoDBマルチドキュメントトランザクション     | ReplicaSet構成に移行                                      |
| 長期       | PostgreSQL＋悲観ロック（`SELECT FOR UPDATE`） | 高競合・フラッシュセール等。ADR Step5のトリガー条件と連動 |

`InventoryRepository` インターフェースはDomain層に固定されているため、将来の移行はApplication層をノータッチで実現できる。

**高競合シナリオが必要になった場合（Sagaパターン）**

```
OrderSaga（コレオグラフィ型）
  1. Order作成（PENDING）
  2. 在庫引き当て試行
     ├─ 成功 → Order を CONFIRMED へ
     └─ 失敗 → 補償トランザクション → Order を FAILED へ → 顧客通知
```

---

## エラー設計方針

### ハッカソンスコープ：3基底クラス

Domain・Application層はHTTPを知らない。errorHandlerがHTTPステータスへの変換責務を持つ。

```
DomainError          → errorHandler → 400
ApplicationError     → errorHandler → 400 or 404（サブクラスで判別）
InfrastructureError  → errorHandler → 500
```

詳細は `docs/step3-application-layer.md` の「エラー基底クラス設計」を参照。

### 将来の細粒度エラー階層設計案

ハッカソンスコープ終了後、以下の粒度に拡張することを推奨する。

```
DomainError
├── InvalidValueObjectError      ← VO構築失敗の基底
│   ├── InvalidOrderIdError
│   ├── InvalidStockQuantityError
│   ├── InvalidClassificationConfidenceError  ← ClassificationConfidence構築失敗
│   └── ...
└── InvalidDomainOperationError  ← 状態遷移違反など（409 Conflict が語義的に正確）
    └── InvalidOrderStatusTransitionError

ApplicationError
├── ResourceNotFoundError        ← 404
└── UseCaseFailedError           ← 400（PlaceOrderFailedError など）

InfrastructureError
└── RepositoryError              ← 500
```

**拡張タイミングの判断基準**: エラー種別ごとに異なるHTTPステータスを返す必要が生じたとき、または監視ツールでエラー種別の分類が必要になったとき。

---

## コンテキスト構成（設計対象）

> **ディレクトリ構成の詳細は `docs/step1-directory-structure.md` を参照**
> **ドメインモデルの詳細は `docs/step2-domain-model.md` を参照**
> **アプリケーション層の詳細は `docs/step3-application-layer.md` を参照**
> **Monitoringコンテキストの詳細は `docs/step4-monitoring-context.md` を参照**

```
src/Contexts/
├── EC/
│   ├── Orders/
│   ├── Inventory/
│   └── Shared/
├── Monitoring/
│   ├── AlertAnalysis/
│   ├── AIInvestigation/
│   └── ReportGeneration/
└── Shared/
```

### スコープ外（ハッカソンでは実装しない）

- ユーザー認証（userIdは固定値でOK）
- 商品マスタ管理UI（データ直入れ）
- 返品・キャンセルフロー
- **ECフロントエンドUI**（Swagger UIで代替）
- 決済処理（PaymentMockGatewayで代替）

### スコープ内（必ず実装する）

- **バックオフィスUI**はReact（CSR）で実装する

#### バックオフィス画面構成

| パス          | 役割                                                     | デモドロワー                     |
| ------------- | -------------------------------------------------------- | -------------------------------- |
| `/alerts`     | アラート一覧 ＋ カード展開（AI分析結果をインライン表示） | **常時表示**（デモのメイン舞台） |
| `/alerts/:id` | フル詳細ページ（運用想定・面接説明用）                   | **非表示**                       |
| `/analytics`  | AI精度トラッキング                                       | 非表示                           |

---

## ECドメインのイベントフロー

```
POST /orders
  ↓ PlaceOrderCommand
PlaceOrderCommandHandler
  ├─ PaymentGateway.run()
  │   └─ 失敗 → PaymentTimeoutDomainEvent → Monitoring
  └─ Order.place()
       └─ OrderPlacedDomainEvent

RabbitMQ
  ├─ ReserveInventoryOnOrderPlaced
  │    └─ All-or-Nothing引き当て（2フェーズ）
  │         ├─ 成功 → InventoryReservedDomainEvent
  │         └─ 失敗 → InventoryReservationFailedDomainEvent
  ├─ CompensateOrderOnInventoryFailed → OrderをFAILEDに遷移
  └─ CollectMonitoringEventOnECDomainEvent → AlertAnalysis → AI分析 → SSE push
```

---

## デモシナリオ（設計に反映すること）

### シナリオ1：既知障害（決済サービスタイムアウト）

```
0. デモドロワーで決済モードを「常にタイムアウト」に切り替え
1. 注文APIを叩く（Swagger UI or curl）
2. PaymentMockGatewayがTimeoutを返す
3. PaymentTimeoutDomainEvent → RabbitMQ → Monitoring
4. 1秒以内にバックオフィスにSSEでリアルタイム表示
```

### シナリオ2：未知障害（DBコネクション枯渇）

```
1. 複数サービスで連鎖エラー発生
2. Monitoringが既知パターン不一致と判断
3. Gemini APIにコンテキストを送信（トークン上限3,500）
4. 「DBコネクションプール枯渇の可能性87%」をバックオフィスに表示
```

### シナリオ3：フィードバックによる学習

```
1. シナリオ2の分析結果に「正解」フィードバック
2. 正解フィードバックがAUTO_PROMOTE_THRESHOLD回に到達
3. 未知パターンが既知パターンに自動昇格
4. 次回同じ障害が1秒以内に既知分類される
```

---

## Monitoringコンテキスト設計方針

> 詳細は `docs/step4-monitoring-context.md` を参照。以下は実装時に必ず守る制約のサマリー。

### AlertClassifierのStrategyパターン

```
AlertClassifier（インターフェース）← 抽象に依存
  ├─ InMemoryAlertClassifier       ← Step1：ハッカソン本体（first-match、完全一致）
  ├─ ElasticAlertClassifier        ← Step2：Elasticsearchスコアリング（類似検索）
  └─ ScoringAlertClassifier        ← 将来差し替える具体（重み付けスコア合算）
```

- Classifierは「`KnownAlertClassification` を構築して返す」責務のみを持つ
- スコアリングの計算ロジックはClassifier実装クラスの内部に閉じる
- `AnalyzeAlertCommandHandler` はインターフェースにのみ依存し、実装切り替えでノータッチ

### AlertClassifierの実装段階戦略（v11追加）

AlertClassifierは以下の3ステップで段階的に強化する。
各ステップは独立してデプロイ可能であり、前ステップが完了していることが次ステップの前提条件となる。

#### ステップ依存関係

```
Step1（InMemory完全一致）
  └─ ハッカソン提出の最低ライン。ここが動かないとStep2・3に進まない

Step2（Elasticスコアリング）
  └─ Step1完了が前提。Elasticsearchにデータが入っていないとElastic Agent Builderが機能しない

Step3（A2A統合）
  └─ Step2完了が前提。Elastic Agent BuilderはElasticsearchの上にしか乗らない
     A2Aは「Elasticエージェントを外部公開する手段」であり、接続先が存在しないと接続できない
```

#### Step1：InMemory完全一致（ハッカソン本体スコープ）

| 項目         | 内容                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| 実装クラス   | `InMemoryAlertClassifier`                                                            |
| マッチ戦略   | first-match（先着優先の完全一致）                                                    |
| confidence   | 1.0固定                                                                              |
| インフラ依存 | なし（オンメモリ）                                                                   |
| **完了条件** | デモシナリオ1・2・3がE2Eで通る。**この状態でコミットを切り、提出できる状態をキープ** |

#### Step2：Elasticsearchスコアリング（ポートフォリオ強化）

| 項目         | 内容                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| 実装クラス   | `ElasticAlertClassifier`                                                                             |
| マッチ戦略   | hybrid search（BM25 + ベクトル検索）による類似スコアリング                                           |
| confidence   | Elasticsearchのスコアを正規化して返す                                                                |
| インフラ依存 | Elastic Cloud（公式サイトから直接登録で14日間無料トライアル）                                        |
| **完了条件** | `ElasticAlertClassifier` がDI切り替えで差し替え可能。InMemoryと並走して比較できる状態                |
| 注意         | **Elastic CloudはGCPマーケットプレイス経由で登録すると無料トライアルがない。公式サイトから登録する** |

**Elastic Cloud費用試算（ハッカソン用途）:**

| 期間                         | 費用         |
| ---------------------------- | ------------ |
| 14日間無料トライアル         | $0           |
| トライアル後〜7/10（〆切）   | $10〜$15程度 |
| 8/19決勝デモまで保持する場合 | $25〜$30追加 |
| **合計（最大見積もり）**     | **$40〜$50** |

障害パターンのインデックスはデータ量が非常に小さいため、Serverless（Elasticsearch Serverless Search）の従量課金で十分。アイドル時間はsearch VCUがゼロにスケールするため実コストはさらに低くなる見込み。

#### Step3：A2A統合（ポートフォリオ別格化）

| 項目           | 内容                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| 実装クラス     | `ADKAgentInvestigationAdapter`（`AIInvestigationPort` に差し込む）                                      |
| 連携方式       | Elastic Agent Builder → A2Aプロトコル → Gemini Enterprise                                               |
| 前提           | Step2完了（Elastic Agent BuilderはElasticsearchの上にのみ構築できる）                                   |
| **完了条件**   | Gemini EnterpriseからA2A経由でElasticエージェントを呼び出せる。`AIInvestigationPort` のDI差し替えで動く |
| 着手タイミング | Elastic Agent Builder Bootcamp（6/23）受講後に着手。それまでにStep1を完了させておく                     |

**Step3で得られるもの（面接・審査員への訴求）:**

- A2Aプロトコルによるエージェント間協調の実装経験
- Gemini Enterprise Agent Platformの実践的活用（審査員評価が大きく上がる）
- 「なぜA2Aか」「なぜElasticか」を設計意図から語れる

#### リスク管理方針

```
Step1完了 → コミットを切って「提出できる状態」を確保
  ↓
Step2着手（Bootcamp前でも進められる）
  ↓
6/23 Bootcamp受講（A2Aのパターン・設計を学ぶ）
  ↓
Step3着手（Bootcamp後）
  ↓
〆切7/10 → 到達したStepで提出
```

Step2・3の途中で〆切を迎えても、Step1の状態で提出できる。
**A2Aがハッカソン〆切に間に合わない場合でも、ADRと設計ドキュメントに「なぜA2Aへ移行すべきか・設計上の準備」を明記することで、ほぼ同等の面接評価が得られる。**

### AlertClassification VOの設計原則（OCP適用）

- `KnownAlertClassification` VOは「何が根拠か」の構造を定義する。計算ロジックは持たない
- 重み情報（各条件がスコアにどれだけ寄与したか）はVOに持たせない（スコアリング戦略の内部情報）
- `ClassificationConfidence` のみクラス化（0.0〜1.0の範囲制約 + 将来の `isHighConfidence()` 用）
- `MatchedCondition` / `UnmatchedCondition` は `interface` のまま（制約も振る舞いも薄い構造体）

**VO粒度の判断基準（面接時の説明用）**:
VOにする価値はドメイン制約と振る舞いの有無で判断する。構造体としての意味しかない型は `interface` で十分。クラス化のトリガーはバリデーションや振る舞いが生えたとき。

### AlertClassifierのスコアリング移行ロードマップ

| フェーズ | 実装                                                         | 移行トリガー                                                                  |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Step1    | `InMemoryAlertClassifier`（first-match、confidence 1.0固定） | -                                                                             |
| Step2    | `ElasticAlertClassifier`（hybrid search、スコア正規化）      | Step1デモ完成後。Bootcamp前でも着手可能                                       |
| Step3    | `ADKAgentInvestigationAdapter`（A2A統合）                    | Step2完了 + Bootcamp（6/23）受講後                                            |
| 将来     | `ScoringAlertClassifier`（重み付けスコア合算、閾値判定）     | 自動昇格パターンが10件超 or `GET /analytics` で誤分類率が計測可能になった時点 |

### フィードバックループの自動昇格

```typescript
const AUTO_PROMOTE_THRESHOLD = 3; // 正解フィードバック3回で自動昇格
// 環境変数 FEEDBACK_AUTO_PROMOTE_THRESHOLD でオーバーライド可能（デモ調整用）
```

- 手動昇格（Promoteボタン）と自動昇格の両方をサポートする
- 自動昇格時は `payloadConditions: []`（eventNameのみでマッチ）で安全側に倒す
- 昇格後の次回同一イベントで `InMemoryAlertClassifier` が即座に既知分類する（シナリオ3）

### MonitoringEventの設計原則

- 単一の `MonitoringEvent` 型にすべてのECイベントをマッピングする
- ECコンテキストの型をMonitoringコンテキストに直接importしない
- `payload: Record<string, unknown>` として均質に扱い、将来のECイベント追加でMonitoringドメインモデルが変わらない構造にする

### PaymentTimeoutDomainEvent受信時の処理方針

- Monitoringは `orderId` の存在確認をしない（OrderがDBに存在しない段階のイベント）
- `Alert.context` に `orderExists: false` を記録し「注文未確定の決済障害」として分類する
- 既知パターン `PAYMENT_TIMEOUT_NO_ORDER` で分類できる

### AIInvestigationPort 設計方針（GCP要件段階移行）

- ポート名は `AIInvestigationPort` のままプロダクト名を含まない抽象名にする
- 実装クラスを3段階で用意し、DIの差し替えのみで移行する

```
AIInvestigationPort（インターフェース）← Application層が依存する抽象
  ├─ GeminiAIInvestigationAdapter      ← フェーズ0：ハッカソン本体（Gemini API直接）
  ├─ VertexAIInvestigationAdapter      ← フェーズ1：Vertex AI SDK経由（推奨経路）
  └─ ADKAgentInvestigationAdapter      ← フェーズ2：ADKエージェント構成（A2A統合）
```

---

## デモコントロールドロワーの設計

- `/alerts` のレイアウト層にのみ差し込む
- `DemoDrawer.tsx` 1コンポーネントで完結
- 環境変数で無効化できる

---

## バックオフィスAPIエンドポイント

```
GET  /alerts
GET  /alerts/:id
PATCH /alerts/:id/feedback
GET  /alerts/stream             ← SSE
GET  /patterns
POST /patterns/:id/promote
GET  /analytics
POST /demo/payment-mode
POST /demo/scenario/:id/trigger
POST /demo/reset
POST /demo/reset/alerts
POST /demo/reset/patterns
POST /demo/reset/analytics
GET  /demo/status
```

---

## 構造化ログ設計

```typescript
interface StructuredLog {
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  service: string;
  trace_id: string;
  span_id: string;
  user_id?: string;
  action?: string;
  message: string;
  timestamp: string;
  error_code?: string;
  retry_count?: number;
  stack_trace?: string;
}
```

OTel統合フロー:

```
各サービス（Express.js）
  └─ @opentelemetry/sdk-node
       ├─ トレース → Cloud Trace
       ├─ メトリクス → Cloud Monitoring
       └─ ログ → Cloud Logging
```

---

## 出力してほしいアウトプット

| Step       | 詳細設計ドキュメント                | ステータス      |
| ---------- | ----------------------------------- | --------------- |
| **Step 1** | `docs/step1-directory-structure.md` | ✅ **確定済み** |
| **Step 2** | `docs/step2-domain-model.md`        | ✅ **確定済み** |
| **Step 3** | `docs/step3-application-layer.md`   | ✅ **確定済み** |
| **Step 4** | `docs/step4-monitoring-context.md`  | ✅ **確定済み** |
| **Step 5** | ADR                                 | 🔲 次のステップ |

### Step 5で作成するADR

1. MongoDBをECドメインに使用する理由
1. ECとMonitoringをRabbitMQで疎結合にする理由
1. Gemini APIへのコンテキストをトークン上限3,500に絞る理由
1. 観測基盤にGCPネイティブを採用する理由と移行判断基準
1. 類似障害検索をインメモリ + CriteriaConverterパターンで実装する理由
1. デモコントロールドロワーを `/alerts` レイアウト層にのみ差し込む理由
1. 構造化ログをOTel一括化しWinstonを使わない理由
1. サンプリングをハッカソンスコープで実装しない理由と将来方針
1. AlertClassifierをStrategyパターンで設計しハッカソンではfirst-matchのみ実装する理由
1. AlertClassification VOに重み情報を持たせずClassifier実装クラスに閉じる理由
1. **AIInvestigationPortをプロダクト名に依存しない抽象名にする理由と段階移行設計**（v10追加）
1. **ハッカソン本体でGemini API直接を選択しVertex AI / ADK移行を後続フェーズとする理由**（v10追加）
1. **AlertClassifierをInMemory → Elastic → A2Aの3ステップで段階強化する理由と各ステップの完了条件**（v11追加）

---

## 設計上の制約・注意事項

### 必ず守ること

- `Shared/domain/` にはインフラ依存のコードを置かない
- DomainEventは必ず `fromPrimitives()` / `toPrimitives()` を持つ
- RepositoryのインターフェースはDomainに置き、実装はInfrastructureに置く
- ECドメインはMonitoringを直接importしない
- MonitoringドメインはECコンテキストの型を直接importしない（`MonitoringEvent` で変換して受け取る）
- `DemoDrawer.tsx` は `/alerts` のレイアウト層にのみ差し込む
- ApplicationService / CommandHandler は `Logger` interfaceにのみ依存し、GCP固有実装を直接importしない
- ApplicationServiceのメソッド名は `run()` で統一する（CodelyTV準拠）
- Domain・Application層はHTTPステータスコードを知らない。errorHandlerがHTTPへの変換責務を持つ
- 外部サービスへのアウトバウンドポートは `XxxGateway` と命名する（`XxxService` はドメインサービスと混同するため使わない）
- ドメインサービスを作る場合は `XxxDomainService` と明示的にサフィックスをつける
- `AlertClassifier` はインターフェースにのみ依存する。`InMemoryAlertClassifier` を直接importしない
- `ClassificationConfidence` のみVOとしてクラス化する。`MatchedCondition` / `UnmatchedCondition` はinterfaceのまま
- **`AIInvestigationPort` はポートインターフェース名にプロダクト名を含めない。`InvestigateAlertCommandHandler` は `AIInvestigationPort` にのみ依存し、実装クラスを直接importしない**（v10追加）
- **`ElasticAlertClassifier` はElastic Cloud公式サイトから直接登録したインスタンスに接続する。GCPマーケットプレイス経由は無料トライアルがないため使用しない**（v11追加）
- **Step3（A2A）はStep2（Elastic）完了後に着手する。接続先が存在しない状態でA2A実装を開始しない**（v11追加）

### ハッカソンスコープで許容する妥協

- 決済は `PaymentMockGateway` で代替（`success` / `random` / `timeout` の3モード）
- フロントエンドはSwagger UIで代替（ECフロント）
- 在庫の同時更新競合は2フェーズ（事前チェック＋楽観ロック＋補償）で対応
- userId認証なし（固定UUIDで代替）
- エラー基底は3クラス（`DomainError` / `ApplicationError` / `InfrastructureError`）のみ。細粒度化は将来の拡張
- AlertClassifierはfirst-matchのみ実装。スコアリングはインターフェースのコメントに将来実装として明記するだけ
- SSEAlertNotifierはEventEmitterオンメモリ。RedisへのスケールアウトはSSEAlertNotifierインターフェースで抽象化済み
- `recentEvents` in InvestigationContextは省略（将来拡張ポイントとして設計注記のみ残す）
- **AIはGemini API直接（フェーズ0）のみ実装。Vertex AI / ADKへの移行はAIInvestigationPortの差し替えで対応できる設計にし、実装はハッカソン後のフェーズに委ねる**（v10追加）
- **AlertClassifierはStep1（InMemory）のみハッカソン提出必須。Step2（Elastic）・Step3（A2A）は工数が許す範囲で積み上げる**（v11追加）

### MongoDBでのトランザクション代替パターン

在庫引き当て:

```
Phase1: 全商品の在庫確認（1品でも不足 → 全体をFail）
Phase2: 全商品を findOneAndUpdate で更新（楽観ロック）
        競合時: リトライ（最大3回） → 上限超過で成功分をロールバック
```

---

## 変更履歴

### v11（AlertClassifier段階戦略・Elastic費用試算追記）

- AlertClassifierの実装を3ステップ（InMemory完全一致 → Elasticスコアリング → A2A統合）に段階化
- 各ステップの完了条件・依存関係・着手タイミングを明記
- Step3（A2A）はStep2（Elastic）完了が前提であることを依存関係として設計ドキュメントに明記
- Elastic Cloud費用試算を追記（ハッカソン用途の最大見積もり$40〜$50）
- GCPマーケットプレイス経由は無料トライアルなしの注意事項を追記
- リスク管理方針（Step1でコミットを切って提出ラインを確保）を明記
- `ElasticAlertClassifier` を技術スタック表・AlertClassifier Strategyに追加
- Step 5 ADR項目に1件追加（AlertClassifier 3ステップ段階戦略）
- 「必ず守ること」にElastic Cloud登録経路・A2A着手タイミングのルールを追記
- 「ハッカソンスコープで許容する妥協」にStep1のみ必須方針を追記

### v10（GCP要件充足戦略・AIInvestigationPort段階移行設計追記）

- ハッカソンGCP要件（要件1・要件2）の充足状況を整理し、3フェーズ移行戦略を確定
- `AIInvestigationPort` のポート名設計方針を追記（プロダクト名を含まない抽象名）
- `GeminiAIInvestigationAdapter` / `VertexAIInvestigationAdapter` / `ADKAgentInvestigationAdapter` の3実装をロードマップとして設計ドキュメントに明記
- 技術スタック表にAI将来フェーズ（Vertex AI SDK / ADK）を追加
- Step 5 ADR項目に2件追加（AIInvestigationPort抽象名設計、フェーズ選択理由）
- 「必ず守ること」に `AIInvestigationPort` インターフェース依存ルールを追記
- 「ハッカソンスコープで許容する妥協」にAIフェーズ0のみ実装方針を追記

### v9（Step 4確定・AlertClassifier設計・VO粒度判断追記）

- Step 4（Monitoringコンテキスト拡張ポイント）を `docs/step4-monitoring-context.md` に分離・確定
- AlertClassifierをStrategyパターンで設計。ハッカソンでは `InMemoryAlertClassifier`（first-match）のみ実装
- AlertClassification VOの設計原則を追記：OCP適用、重み情報はVOに持たせない
- `ClassificationConfidence` のみVOクラス化。`MatchedCondition` / `UnmatchedCondition` はinterfaceのまま（VO粒度の判断基準を明記）
- フィードバックループの自動昇格しきい値を `AUTO_PROMOTE_THRESHOLD = 3`（環境変数でオーバーライド可能）として確定
- `MonitoringEvent` 単一型の設計原則を追記（ECコンテキストの型をMonitoringに持ち込まない）
- Step 5のADR項目に2件追加（AlertClassifier Strategyパターン、AlertClassification VOの重み分離）
- 「必ず守ること」に `AlertClassifier` インターフェース依存・VO粒度ルールを追記
- デモシナリオ3をフィードバック自動昇格の流れに合わせて更新

### v8（Step 3確定・エラー設計・在庫戦略ロードマップ追記）

- Step 3（アプリケーション層設計）を `docs/step3-application-layer.md` に分離・確定
- `PaymentService` → `PaymentGateway` に命名変更（アウトバウンドポートの意図を明示）
- ApplicationServiceのメソッド名を `run()` に統一（CodelyTV準拠。`process()` から変更）
- エラー設計方針を追記：3基底クラス（ハッカソンスコープ）と将来の細粒度エラー階層設計案
- 在庫引き当て戦略をAll-or-Nothing（B案）に変更。将来の移行ロードマップを追記
- 「必ず守ること」に `run()` 統一・`XxxGateway` 命名・HTTP非依存の原則を追記
