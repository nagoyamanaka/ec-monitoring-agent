# Step 4-2: Monitoring コンテキスト詳細設計（bounded context）

> **本ドキュメントは Step4 を4分割したうちの「context/Monitoring」担当です。**
> Monitoring コンテキストの domain / application / infrastructure の設計に責務を限定する。
> Express アプリ配線（routes/controllers/DI/SSE接続）は `step4-3`、UIは `step4-4` を参照。
>
> **Step4 ファミリー（進める順番＝ファイル番号順）**
>
> | 順 | スコープ            | 設計ドキュメント                      | TODO                                       |
> | -- | ------------------- | ------------------------------------- | ------------------------------------------ |
> | 1  | 戦略設計            | `docs/step4-1-strategy.md`            | `docs/step4-1-strategy-todo.md`            |
> | 2  | context/Monitoring  | `docs/step4-2-monitoring-context.md`  | `docs/step4-2-monitoring-context-todo.md`  |
> | 3  | backoffice/backend  | `docs/step4-3-backoffice-backend.md`  | `docs/step4-3-backoffice-backend-todo.md`  |
> | 4  | backoffice/frontend | `docs/step4-4-backoffice-frontend.md` | `docs/step4-4-backoffice-frontend-todo.md` |
>
> 前提となる設計:
>
> - ディレクトリ構成: `docs/step1-directory-structure.md`
> - ドメインモデル: `docs/step2-domain-model.md`
> - アプリケーション層: `docs/step3-application-layer.md`
> - 戦略・スコープ・優先度: `docs/step4-1-strategy.md`
> - プロジェクト全体方針: `docs/project-prompt.md`
>
> **整合性メモ（v12時点）**: 本ドキュメントは以下をリポジトリのコード・上位ドキュメントに整合させて更新済み。
>
> - ECイベントの実フィールド（`OrderPlacedDomainEvent` 等）に合わせて変換規則表を修正
> - `InvestigationReport` に調査ステップ・レビューステータス（`reviewStatus`）を追加（step1 の「AIが調査し人間がレビューする」体験価値に整合）
> - `AIInvestigationPort` の段階移行（Gemini直接 → Vertex AI → ADK）を明記（project-prompt v10）
> - `AlertClassifier` の段階強化（InMemory → Elastic → Scoring/A2A）を明記（project-prompt v11）
> - インフラ横断調査パイプライン（`InfraInvestigationPort` / 各Gateway / `InfraEvidence`）を追加（project-prompt v12）
> - `MonitoringEvent.category`（APPLICATION/INFRASTRUCTURE/CAPACITY/SECURITY）の弁別子を追加（a2a非依存のルーティングキー）
> - ADKマルチエージェント実装（Coordinator + 専門agent + 自律証拠ループ）を追加（a2aは使わない方針）
> - CI/CD連携のセキュリティインシデント＋自律リメディエーション（`RemediationPort` / 人間承認ゲート付きPR起票）を追加（v13）

---

## 設計判断メモ（本ドキュメント確定時の議論）

| 判断項目                                  | 決定内容                                                                                                                                                    | 理由                                                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MonitoringEventの型粒度                   | 単一の `MonitoringEvent` 型にすべてのECイベントをマッピング                                                                                                 | ECイベント種別ごとにサブクラスを作ると、MonitoringコンテキストがECの型構造に引っ張られる。Monitoringは「観測データ」として均質に扱うのが責務上自然                                |
| 障害レイヤーの表現方法                    | サブクラス分けではなく `MonitoringEvent.category`（APPLICATION / INFRASTRUCTURE / CAPACITY / SECURITY）の弁別子フィールドで表現                              | payload を均質に保つ原則を崩さない。`category` は InfraInvestigation の証拠源選択と、将来の調査担当ルーティング（in-process / a2a 委譲）の**ディスパッチキー**になり、a2aの有無に依存しない前方互換を持つ |
| VO粒度の判断基準                          | `ClassificationConfidence` のみクラス化。`MatchedCondition` / `UnmatchedCondition` は `interface` のまま                                                    | VOにする価値はドメイン制約と振る舞いの有無で判断する。`Confidence` は範囲制約 + 将来の `isHighConfidence()` が明確。`MatchedCondition` は構造体でしかなく制約も振る舞いも薄い     |
| AlertClassificationのOCP + Strategy適用   | `KnownAlertClassification` VOは「何が根拠か」の構造のみ定義。重み・スコア計算はClassifier実装クラスの内部ロジックとしてVOに露出しない                       | スコアリング戦略が変わるたびにVOスキーマが変わるとOCP違反。「どう計算したか」はClassifierが知り、「何が根拠か」だけをVOが永続記録する責務分離                                     |
| AlertClassifierのマッチング戦略（今回）   | EVENT_NAME 完全一致 + payload 部分マッチ（first-match）。`KnownAlertClassification.confidence: 1.0` 固定                                                    | ハッカソンスコープとして十分。`AlertClassifier` インターフェースは維持し、将来スコアリング実装へ差し替え可能にする                                                                |
| AlertClassifierのマッチング戦略（将来）   | スコアリングベース（複数パターンへの重み付けスコア合算）。`confidence` が閾値未満の場合は未知扱い                                                           | 「未知障害の推測精度向上」と「作業員の意思決定支援」が本来の目的。部分一致の度合いをスコアで表現することで、複数パターンへの可能性を並列提示できる                                |
| AlertClassification への confidence 配置  | `AlertClassification` に `confidence: number \| null` を持たせる。既知一致は `1.0`、未知は `null`（AI分析後は `InvestigationReport.confidence` が別途存在） | 将来のスコアリング移行後も同一フィールドに `0.87` 等を格納できる。UIが `classification.confidence` を参照するだけで両世代のデータを扱える                                         |
| 既知パターン昇格トリガー                  | 手動（Promoteボタン）+ 自動（correctフィードバックがN回到達で自動昇格）                                                                                     | デモシナリオ3の「次回同じ障害が1秒以内に既知分類される」を自動で示せる。手動はオペレーターの明示的な判断も残す                                                                    |
| InvestigationReportの配置                 | Alert集約に直接埋め込む（別集約にしない）                                                                                                                   | Alert IDで常にセットで参照される。ライフサイクルも同一。分離のメリット（独立した集約操作）がない                                                                                  |
| SSEAlertNotifierの実装                    | Node.js EventEmitterオンメモリ（シングルプロセス前提）                                                                                                      | e2-medium単一プロセス構成。Redis追加はインフラコストと複雑性を上げる。スケールアウトが必要になった時点でRedis Pub/Subに差し替える（SSEAlertNotifierインターフェースで抽象化済み） |
| PaymentTimeoutDomainEvent受信時のorderId  | MonitoringEventに `orderId?: string` として保持し、Alertレベルで「注文未確定の決済障害」として分類する                                                      | OrderがDBに存在しない段階のイベント。Monitoringが無理にOrderを引きに行かない設計にする                                                                                            |
| SimilarIncidentRepositoryのウォームアップ | 起動時にMongoDBから既存ResolvedIncidentを読み込んでインメモリ構築                                                                                           | ハッカソン規模では再起動頻度が低い。コールドスタート時の1〜2秒は許容範囲                                                                                                          |

---

## 全体フロー（Step 3 → Step 4 接合点）

```
[EC Backend]
  RabbitMQ publish
    ├─ ec.order.placed
    ├─ ec.inventory.reservation_failed
    └─ ec.payment.timeout

[Backoffice Backend]
  CollectMonitoringEventOnECDomainEvent (Subscriber)
    │
    ↓ ECDomainEvent → MonitoringEvent 変換
    │
    AnalyzeAlertCommandHandler
    │
    ├─【既知パターン一致】
    │    AlertClassifier.classify() → KnownAlertClassification
    │    Alert.createFromKnownPattern()
    │    AlertRepository.save()
    │    SSEAlertNotifier.notify()  ← フロントに即時push
    │
    └─【未知パターン】
         Alert.createAsUnknown()
         AlertRepository.save()
         SSEAlertNotifier.notify()  ← フロントに即時push（分析中ステータス）
         │
         InvestigateAlertCommandHandler
           │
           ├─ InfraInvestigationPort.collect()  ← Cloud Logging / Terraform / GitHub（証拠収集）
           ├─ SimilarIncidentRepository.findSimilar()
           ├─ InvestigationContext 構築（トークン上限 3,500・InfraEvidence含む）
           ├─ AIInvestigationPort.investigate()  ← Gemini API
           │
           Alert.attachInvestigationReport()
           AlertRepository.save()
           SSEAlertNotifier.notify()  ← フロントに分析結果push

[フィードバックループ]
  SubmitFeedbackCommandHandler
    ├─ Alert.submitFeedback(isCorrect)
    │    └─ correctCount += 1（isCorrect時）
    ├─ correctCount >= AUTO_PROMOTE_THRESHOLD
    │    → KnownErrorPatternRepository.save() で自動昇格
    └─ AlertRepository.save()
```

---

## MonitoringEvent

**ファイルパス**: `src/Contexts/Monitoring/Shared/domain/MonitoringEvent.ts`

ECコンテキストのDomainEventをMonitoringコンテキスト固有の型に変換したもの。
Monitoringは「何が起きたか」を均質なデータとして扱い、ECの型構造に依存しない。

```typescript
export type MonitoringEventPrimitives = {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredOn: string; // ISO 8601
  readonly payload: Record<string, unknown>;
  readonly category: string;
  readonly source: string;
};

export class MonitoringEvent {
  readonly eventId: string; // DomainEvent.eventId そのまま
  readonly eventName: string; // DomainEvent.EVENT_NAME そのまま（例: 'ec.payment.timeout'）
  readonly aggregateId: string; // orderId / productId など
  readonly occurredOn: Date;
  readonly payload: Record<string, unknown>; // toPrimitives() の結果（ECの型を直接importしない）
  readonly category: MonitoringEventCategory; // 障害レイヤーの粗い弁別子（ルーティングキー）
  readonly source: string; // 発生元の細粒度ラベル（'order' / 'inventory' / 'payment' / 'rabbitmq' など。拡張に開く）

  constructor(params: { ... }) { ... }

  toPrimitives(): MonitoringEventPrimitives { ... }
  static fromPrimitives(primitives: MonitoringEventPrimitives): MonitoringEvent { ... }
}
```

---

## MonitoringEventCategory（障害レイヤーの弁別子）

**ファイルパス**: `src/Contexts/Monitoring/Shared/domain/MonitoringEventCategory.ts`

サブクラスではなく単一 `MonitoringEvent` 型上の弁別子フィールドにする。
「どの調査担当（InfraInvestigationの証拠源 / 将来の専門エージェント）に振るか」の
ルーティングキーとして機能し、a2aの有無に関わらず前方互換。

```typescript
export enum MonitoringEventCategories {
  APPLICATION = "APPLICATION", // アプリコード起因（PaymentTimeout / InventoryReservationFailed 等）
  INFRASTRUCTURE = "INFRASTRUCTURE", // インフラ起因（RabbitMQ断 / IaC変更 等）
  CAPACITY = "CAPACITY", // キャパシティ起因（TrafficSpike 等）
  SECURITY = "SECURITY", // セキュリティ起因（Critical Vulnerability 等）
}

export class MonitoringEventCategory extends EnumValueObject<MonitoringEventCategories> {
  static application(): MonitoringEventCategory { ... }
  static infrastructure(): MonitoringEventCategory { ... }
  static capacity(): MonitoringEventCategory { ... }
  static security(): MonitoringEventCategory { ... }
  static fromString(value: string): MonitoringEventCategory { ... }
}
```

### category の役割と弁別子設計（a2a前方互換）

`category` は「障害がどのレイヤーか」を表す粗い弁別子で、**サブクラス分けではなく単一 `MonitoringEvent` 型上のフィールド**にする（payload を均質に保つ原則を維持）。この1フィールドが次の2つのルーティングに効く：

1. **InfraInvestigation の証拠源選択**（今フェーズで意味を持つ）
   - `INFRASTRUCTURE` → Terraform差分 + Cloud Logging を厚めに収集
   - `SECURITY` → GitHub（npm audit結果・依存更新PR）を厚めに収集
   - `CAPACITY` → Cloud Monitoring メトリクス（次フェーズGateway）
   - `APPLICATION` → アプリログ中心
2. **将来の調査担当ルーティング**（a2a の有無に依存しない）
   - a2aなし: in-process の専門ロジック（ADKサブエージェント or 型付き関数）へ分岐
   - a2aあり: `category` をキーに専門エージェント（app/infra/security investigator）へ A2A 委譲
   - → **どちらに進んでも `category` がそのままディスパッチキーになる**ため、今入れておくのが最小コストで最大の前方互換

ハッカソン本体で実際に発火するのは `APPLICATION`（EC障害イベント）。`INFRASTRUCTURE` / `CAPACITY` / `SECURITY` は各イベントソース（RabbitMQ監視 / トラフィック監視 / GitHub Actions の npm audit）を足した時点で同じ `MonitoringEvent` 経路に流れる拡張ポイント。

### ECDomainEvent → MonitoringEvent 変換規則

| ECDomainEvent                           | eventName                         | category      | source      | aggregateId        | payloadのキー（`toPrimitives()` の実体）                            |
| --------------------------------------- | --------------------------------- | ------------- | ----------- | ------------------ | ------------------------------------------------------------------ |
| `OrderPlacedDomainEvent`                | `ec.order.placed`                 | `APPLICATION` | `order`     | orderId            | customerId, items, subtotalAmount                                  |
| `InventoryReservationFailedDomainEvent` | `ec.inventory.reservation_failed` | `APPLICATION` | `inventory` | productId          | orderId, requestedQuantity, currentStock, reason, reservedProductIds |
| `PaymentTimeoutDomainEvent`             | `ec.payment.timeout`              | `APPLICATION` | `payment`   | paymentAttemptId   | orderId, customerId, amount                                        |
| （将来）RabbitMQ Connection Lost        | `infra.rabbitmq.disconnected`     | `INFRASTRUCTURE` | `rabbitmq`  | connectionId       | （拡張ポイント。同一 MonitoringEvent 経路に流す）                  |
| （将来）Traffic Spike Detected          | `capacity.traffic_spike`          | `CAPACITY`    | `traffic`   | -                  | （拡張ポイント）                                                   |
| （将来）Critical Vulnerability Detected | `security.vulnerability_detected` | `SECURITY`    | `npm_audit` | -                  | （拡張ポイント。GitHub Actions → npm audit から発火）             |

> **コード整合の注記**:
>
> - `OrderPlacedDomainEvent` の金額フィールドは `subtotalAmount`（`totalAmount` ではない）。
> - `InventoryReservationFailedDomainEvent` は補償処理用に `reservedProductIds`（成功済み商品IDリスト）を payload に含む。
> - `PaymentTimeoutDomainEvent` の `aggregateId` は `paymentAttemptId`。注文は未確定のため orderId は payload 側に持つ。`reason` フィールドは存在しない（決済タイムアウトは単一の事象として扱う）。

変換責務は `CollectMonitoringEventOnECDomainEvent` Subscriber が持つ。

---

## CollectMonitoringEventOnECDomainEvent（詳細）

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/infrastructure/subscribers/CollectMonitoringEventOnECDomainEvent.ts`

### 購読キュー

```
backoffice-backend.ec.order.placed.collect-monitoring-event
backoffice-backend.ec.inventory.reservation_failed.collect-monitoring-event
backoffice-backend.ec.payment.timeout.collect-monitoring-event
```

`ec.inventory.reserved`（正常系）は購読しない。障害検知に必要なイベントのみに絞る。

### 処理フロー

```
1. RabbitMQからメッセージを受信する
2. eventName でルーティングしてデシリアライズする
   ├─ 'ec.order.placed'                   → OrderPlacedDomainEvent.fromPrimitives()
   ├─ 'ec.inventory.reservation_failed'   → InventoryReservationFailedDomainEvent.fromPrimitives()
   └─ 'ec.payment.timeout'               → PaymentTimeoutDomainEvent.fromPrimitives()
3. MonitoringEvent に変換する（変換規則は上表参照）
4. AnalyzeAlertCommand を構築して AnalyzeAlertCommandHandler.run() を呼び出す
5. 成功 → ack
6. 失敗 → Logger.write(ERROR) → nack → DeadLetterキューに転送
```

### PaymentTimeoutDomainEvent 受信時の特別処理

PaymentTimeout発生時はOrderがDBに存在しない（決済が注文確定前にタイムアウトするため）。Monitoringは以下のように扱う：

- `aggregateId` は `paymentAttemptId`（決済試行ID）であり、orderIdではない
- `MonitoringEvent.payload.orderId` は「障害発生時に試みた注文ID」として保持する（存在確認しない＝Monitoringが無理にOrderを引きに行かない）
- `AlertClassifier` は `ec.payment.timeout` を既知パターン `PAYMENT_TIMEOUT`（CRITICAL）として分類する
- バックオフィス表示では「注文未確定の決済障害」というラベルを使う（払い出し済み決済の取りこぼし検知に直結するため severity は高め）

---

## Alert集約

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/domain/Alert.ts`

### プロパティ

| プロパティ             | 型                            | 説明                                         |
| ---------------------- | ----------------------------- | -------------------------------------------- |
| `id`                   | `AlertId`                     | 集約識別子                                   |
| `monitoringEvent`      | `MonitoringEvent`             | 原因となったECイベント                       |
| `severity`             | `AlertSeverity`               | CRITICAL / WARNING / INFO                    |
| `status`               | `AlertStatus`                 | OPEN / ANALYZING / RESOLVED                  |
| `classification`       | `AlertClassification`         | 既知/未知の分類結果                          |
| `investigationReport`  | `InvestigationReport \| null` | AI分析結果（未知障害時のみ）                 |
| `feedback`             | `AlertFeedback \| null`       | オペレーターのフィードバック                 |
| `correctFeedbackCount` | `number`                      | 正解フィードバック累計（自動昇格判定に使用） |
| `createdAt`            | `Date`                        |                                              |
| `updatedAt`            | `Date`                        |                                              |

### ファクトリメソッド

```typescript
static createFromKnownPattern(params: {
  id: AlertId;
  monitoringEvent: MonitoringEvent;
  classification: KnownAlertClassification; // VOとして受け取る（patternIdはVO内に含まれる）
}): Alert
```

- `status` を `OPEN` に設定する
- `severity` を `classification.patternId` 経由でパターンから引くのではなく、`KnownErrorPattern.severity` を `classification` 構築時点で解決済みにする設計にする（Alert集約がKnownErrorPatternを直接参照しない）
- `classification` をそのままセットする（`matchedConditions` / `unmatchedConditions` 含む）
- `investigationReport` は `null`

```typescript
static createAsUnknown(params: {
  id: AlertId;
  monitoringEvent: MonitoringEvent;
}): Alert
```

- `status` を `ANALYZING` に設定する
- `severity` を `WARNING` に設定する（AI分析後に更新）
- `classification` を `UnknownAlertClassification` に設定する

### 状態変更メソッド

```typescript
attachInvestigationReport(report: InvestigationReport): Alert
```

- イミュータブル設計。新しい `Alert` インスタンスを返す
- `investigationReport` にセットする
- `severity` を `report.severity` で上書きする
- `status` を `OPEN` に変更する（ANALYZINGからの遷移）
- `updatedAt` を更新する

```typescript
submitFeedback(params: {
  isCorrect: boolean;
  operatorNote?: string;
}): Alert
```

- イミュータブル設計。新しい `Alert` インスタンスを返す
- `feedback` にセットする
- `isCorrect === true` の場合は `correctFeedbackCount` をインクリメントする
- `investigationReport` が存在する場合は `investigationReport.withReviewStatus(isCorrect ? APPROVED : REJECTED)` で新しいレポートを生成する（承認/却下フィードバック）
- `updatedAt` を更新する

```typescript
toPrimitives(): AlertPrimitives
static fromPrimitives(params: AlertPrimitives): Alert
```

---

## AlertClassification（Value Object）

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/domain/AlertClassification.ts`

### 設計方針（OCP + Strategyパターン適用）

責務の分離を以下のように確定する：

- **`KnownAlertClassification` VO**：「何が根拠か」の構造を定義する。計算ロジックは持たない
- **`AlertClassifier` 実装クラス**：`KnownAlertClassification` を構築する責務を持つ（Strategyパターン）
- **重み・スコア計算**：Classifier実装クラスの内部ロジック。VOには露出しない

重み情報をVOに持たせないのは意図的な設計判断。スコアリング戦略が変わるたびにVOのスキーマが変わるとOCP違反になる。「どう計算したか」はClassifierが知り、「何が根拠か」だけをVOが記録する。

```typescript
type AlertClassification =
  | KnownAlertClassification
  | UnknownAlertClassification;

// -------------------------------------------------------------------
// Confidence Value Object
// クラス化の理由: 0.0〜1.0の範囲制約 + 将来の振る舞い（isHighConfidence等）を持つ
// -------------------------------------------------------------------
class ClassificationConfidence {
  private constructor(readonly value: number) {}

  static of(value: number): ClassificationConfidence {
    if (value < 0 || value > 1) {
      throw new InvalidClassificationConfidenceError(value);
    }
    return new ClassificationConfidence(value);
  }

  static certain(): ClassificationConfidence {
    return new ClassificationConfidence(1.0); // first-match時の固定値
  }

  // 将来のスコアリング移行後に意味を持つ振る舞い
  isHighConfidence(threshold = 0.8): boolean {
    return this.value >= threshold;
  }

  toPrimitive(): number {
    return this.value;
  }
}

// -------------------------------------------------------------------
// MatchedCondition / UnmatchedCondition
// interfaceのまま（制約も振る舞いも薄い構造体）
// クラス化する場合のトリガー: バリデーションや振る舞いが生えたとき
// -------------------------------------------------------------------
interface MatchedCondition {
  readonly field: string; // 例: 'eventName', 'payload.reason'
  readonly expectedValue: unknown; // パターン側の期待値
  readonly actualValue: unknown; // イベント側の実値
  // weight は持たない：スコアリング戦略の内部情報であり根拠の記録には不要
}

interface UnmatchedCondition {
  readonly field: string; // 一致しなかったフィールド（反証情報）
  readonly expectedValue: unknown; // パターン側の期待値
  readonly actualValue: unknown; // イベント側の実値（なぜ外れたかの手がかり）
  // weight は持たない：同上
}

// -------------------------------------------------------------------
// AlertClassification union type
// -------------------------------------------------------------------
interface KnownAlertClassification {
  readonly type: "known";
  readonly patternId: string;
  readonly patternName: string;
  // KnownErrorPattern.severity を Classifier 側で解決済み（Alert が KnownErrorPattern に直接依存しない）
  readonly severity: AlertSeverity;
  readonly confidence: ClassificationConfidence; // VOとして制約と振る舞いを持つ
  readonly matchedConditions: MatchedCondition[]; // 何が一致したか（根拠）
  readonly unmatchedConditions: UnmatchedCondition[]; // 何が一致しなかったか（反証・作業員の意思決定補助）
}

interface UnknownAlertClassification {
  readonly type: "unknown";
  readonly confidence: null;
  // パターン未一致。AI分析後は InvestigationReport が別途根拠を持つ
}
```

### VO粒度の判断基準（設計注記）

| 要素                       | 扱い             | 理由                                                                                                              |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ClassificationConfidence` | **クラス（VO）** | `0.0〜1.0` の範囲制約 + `isHighConfidence()` 等の振る舞いが将来生える。CodelyTVの `ValueObject<T>` パターンに沿う |
| `MatchedCondition`         | **interface**    | フィールドを束ねる構造体。制約も振る舞いも薄い。クラス化のトリガー：バリデーションや振る舞いが生えたとき          |
| `UnmatchedCondition`       | **interface**    | 同上                                                                                                              |

### confidence の世代別意味

| フェーズ             | KnownAlertClassification                 | UnknownAlertClassification                                             |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| 今回（first-match）  | `confidence: 1.0`（完全一致のみ既知）    | `confidence: null` → Gemini が `InvestigationReport.confidence` を返す |
| 将来（スコアリング） | `confidence: 0.7〜1.0`（閾値以上で既知） | `confidence: null`（閾値未満、Geminiへ）                               |

UIは `classification.confidence` と `matchedConditions` / `unmatchedConditions` を参照するだけで、両世代のデータを同一コードで表示できる。

### AlertClassifier インターフェース

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/domain/AlertClassifier.ts`

```typescript
interface AlertClassifier {
  classify(
    monitoringEvent: MonitoringEvent,
    knownPatterns: KnownErrorPattern[],
  ): AlertClassificationResult;
}

// Classifierの戻り値はシンプルに保つ。根拠の詳細はVOが持つ責務
type AlertClassificationResult =
  | { matched: true; classification: KnownAlertClassification }
  | { matched: false };
```

**設計ポイント**: `AlertClassificationResult` にはスコアや根拠を持たせない。`classification: KnownAlertClassification` をそのままAlertに渡すだけなので、`AnalyzeAlertCommandHandler` はClassifierの内部実装に依存しない。

**段階強化ロードマップ（project-prompt v11 準拠）**:

```
AlertClassifier（インターフェース）← AnalyzeAlertCommandHandler はこの抽象にのみ依存
  ├─ InMemoryAlertClassifier   ← Step1：ハッカソン本体（first-match・完全一致・confidence 1.0固定）
  ├─ ElasticAlertClassifier    ← Step2：Elasticsearch hybrid search（BM25 + ベクトル）で類似スコアリング
  └─ ScoringAlertClassifier    ← 将来：重み付けスコア合算（同等のスコアリング戦略の別実装）
```

**Step1の実装**: `InMemoryAlertClassifier`（first-match、confidence 固定 1.0）

**Step2の実装**: `ElasticAlertClassifier`

- 既知パターンをElasticsearchにインデックスし、`MonitoringEvent`（+後述の `InfraEvidence`）をクエリにして hybrid search で照合する
- Elasticsearchのスコアを正規化して `ClassificationConfidence` にマッピングする
- `unmatchedConditions` に「スコアを下げた要因」が自然に入るため、作業員が「なぜ完全一致でないか」を確認できる
- 閾値未満の場合は `{ matched: false }` を返す（未知扱いでGeminiへ）
- インフラ証拠（InfraEvidence）でクエリを多次元化するほど照合精度が上がる（v12のシナジー。後述）

**Step3（A2A）**: `ADKAgentInvestigationAdapter` 経由で Elastic Agent Builder → A2A → Gemini Enterprise（Step2完了・6/23 Bootcamp受講後に着手）

**スコアリング/Elastic移行のトリガー条件**（ADR Step 5 に記載）:

- 自動昇格したパターンが10件を超えた時点
- `GET /analytics` で誤分類率の計測が可能になった時点

---

## KnownErrorPattern エンティティ

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/domain/KnownErrorPattern.ts`

### プロパティ

| プロパティ          | 型                   | 説明                                                      |
| ------------------- | -------------------- | --------------------------------------------------------- |
| `id`                | `string`             | UUID                                                      |
| `name`              | `string`             | パターン名（例: 'PAYMENT_TIMEOUT'）                       |
| `description`       | `string`             | 障害の説明（バックオフィス表示・Geminiコンテキスト用）    |
| `eventNamePattern`  | `string`             | マッチ対象のEVENT_NAME（完全一致）                        |
| `payloadConditions` | `PayloadCondition[]` | payloadの部分マッチ条件（空配列はeventNameのみでマッチ）  |
| `severity`          | `AlertSeverity`      | このパターンのデフォルト重要度                            |
| `suggestedAction`   | `string`             | 推奨対応アクション（バックオフィス表示用）                |
| `isPromoted`        | `boolean`            | 自動昇格済みか（シナリオ3のフィードバックで true になる） |
| `promotedAt`        | `Date \| null`       | 昇格日時                                                  |
| `createdAt`         | `Date`               |                                                           |

### PayloadCondition

```typescript
interface PayloadCondition {
  readonly field: string; // payloadのキー（例: 'reason'）
  readonly value: unknown; // 期待値（完全一致）
}
```

### シードデータ（既知パターン初期値）

デモ起動時に `POST /demo/reset` でMongoDBに投入する。

| name                            | eventNamePattern                  | payloadConditions                                 | severity |
| ------------------------------- | --------------------------------- | ------------------------------------------------- | -------- |
| `PAYMENT_TIMEOUT`               | `ec.payment.timeout`              | `[]`（eventNameのみ）                             | CRITICAL |
| `INVENTORY_INSUFFICIENT`        | `ec.inventory.reservation_failed` | `[{field:'reason', value:'INSUFFICIENT_STOCK'}]`  | WARNING  |
| `INVENTORY_CONCURRENT_CONFLICT` | `ec.inventory.reservation_failed` | `[{field:'reason', value:'CONCURRENT_CONFLICT'}]` | WARNING  |

> **注**: `ec.payment.timeout` は payload に `reason` を持たないため、決済タイムアウトのパターンは `PAYMENT_TIMEOUT` 1つに集約する（旧版にあった `PAYMENT_TIMEOUT_NO_ORDER` は eventNamePattern が重複し first-match で到達不能だったため削除）。「注文未確定」はパターンではなく表示ラベルとして扱う。

---

## InMemoryAlertClassifier（Infrastructure実装）

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/infrastructure/InMemoryAlertClassifier.ts`

マッチングロジック（今回の first-match 実装）：

```
1. knownPatterns を順番に評価する（createdAt ASC 順がそのままマッチング優先度）
2. 各パターンについて:
   a. eventName の一致確認 → matched / unmatched に振り分ける
   b. payloadConditions を全件評価 → matched / unmatched に振り分ける
   c. eventName + 全payloadConditionsが一致した最初のパターンで KnownAlertClassification を構築する:
      {
        type: 'known',
        patternId: pattern.id,
        patternName: pattern.name,
        confidence: 1.0,
        matchedConditions: [
          { field: 'eventName', expectedValue: 'ec.payment.timeout', actualValue: 'ec.payment.timeout' },
          { field: 'payload.reason', expectedValue: 'TIMEOUT', actualValue: 'TIMEOUT' },
        ],
        unmatchedConditions: []  // first-matchの完全一致なので空
      }
      → { matched: true, classification }
3. すべてのパターンが不一致 → { matched: false }
```

**設計ポイント**: first-matchの完全一致では `unmatchedConditions` は空になる。`confidence` は `ClassificationConfidence.certain()`（= 1.0）で構築する。将来の `ScoringAlertClassifier` では部分一致のパターンが選ばれた場合に `unmatchedConditions` に反証情報が入り、`ClassificationConfidence.of(0.87)` のように実スコアが入る。VOの構造もUIコードもDBスキーマも変更不要。

---

## AnalyzeAlertCommandHandler

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/application/AnalyzeAlert/AnalyzeAlertCommandHandler.ts`

### 依存関係

| 依存                          | 種別      | 理由                                  |
| ----------------------------- | --------- | ------------------------------------- |
| `AlertRepository`             | interface | Alert永続化                           |
| `KnownErrorPatternRepository` | interface | 既知パターン取得                      |
| `AlertClassifier`             | interface | 既知/未知分類                         |
| `EventBus`                    | interface | InvestigateAlertCommand発行（未知時） |
| `SSEAlertNotifier`            | interface | フロントへの即時push                  |
| `Logger`                      | interface | 構造化ログ                            |

### AnalyzeAlertCommand

```typescript
interface AnalyzeAlertCommand {
  readonly alertId: string; // 新規生成UUID（Controller/Subscriber側で生成）
  readonly monitoringEvent: {
    // MonitoringEvent のプリミティブ（MonitoringEventPrimitives と対応）
    eventId: string;
    eventName: string;
    aggregateId: string;
    occurredOn: string; // ISO 8601
    payload: Record<string, unknown>;
    category: string; // MonitoringEventCategory の string 値
    source: string;
  };
}
```

### 処理フロー

```
1. KnownErrorPatternRepository.findAll() で既知パターン一覧を取得する
2. AlertClassifier.classify(monitoringEvent, patterns) を呼び出す
   → result: AlertClassificationResult

【既知パターン一致の場合】（result.matched === true）
3a. Alert.createFromKnownPattern({ id, monitoringEvent, classification: result.classification }) を生成する
    ※ result.classification は KnownAlertClassification VOとして完結している
4a. AlertRepository.save(alert) を呼び出す
5a. SSEAlertNotifier.notify(alert.toPrimitives()) を呼び出す
6a. Logger.write(INFO, 'alert_classified_known', { alertId, patternName })

【未知パターンの場合】
3b. Alert.createAsUnknown({ id, monitoringEvent }) を生成する
4b. AlertRepository.save(alert) を呼び出す
5b. SSEAlertNotifier.notify(alert.toPrimitives())  ← 「分析中」ステータスで即時push
6b. EventBus.publish(new InvestigateAlertDomainEvent(alertId, monitoringEvent))
    ← InvestigateAlertCommandHandler を非同期でトリガー
7b. Logger.write(WARN, 'alert_classified_unknown', { alertId })
```

**設計ポイント**: 未知障害の場合、`ANALYZING` ステータスのAlertをSSEで即時pushし、フロントに「分析中」と表示させる。Gemini APIの応答（数秒）後に `OPEN` ステータスで再pushされる。

---

## InvestigateAlertCommandHandler

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/application/InvestigateAlert/InvestigateAlertCommandHandler.ts`

### 依存関係

| 依存                        | 種別      | 理由                                          |
| --------------------------- | --------- | --------------------------------------------- |
| `AlertRepository`           | interface | Alert取得・更新                               |
| `SimilarIncidentRepository` | interface | 類似インシデント検索                          |
| `InfraInvestigationPort`    | interface | インフラ横断証拠収集（Cloud Logging/Terraform/GitHub。v12） |
| `AIInvestigationPort`       | interface | Gemini API呼び出し                            |
| `SSEAlertNotifier`          | interface | 分析結果のpush                                |
| `Logger`                    | interface | 構造化ログ                                    |

### InvestigateAlertCommand

```typescript
interface InvestigateAlertCommand {
  readonly alertId: string;
  readonly monitoringEvent: {
    // MonitoringEventPrimitives と対応
    eventId: string;
    eventName: string;
    aggregateId: string;
    occurredOn: string;
    payload: Record<string, unknown>;
    category: string; // MonitoringEventCategory の string 値
    source: string;
  };
}
```

### 処理フロー

```
1. AlertRepository.findById(alertId) を呼び出す
   └─ null → Logger.write(WARN) → return（冪等性：アラート削除済みは無視）

2. SimilarIncidentRepository.findSimilar(
     new Criteria([
       new Filter('eventName', FilterOperator.EQUAL, monitoringEvent.eventName)
     ])
   ) を呼び出す
   → similarIncidents: SimilarIncident[]（最大5件）

2.5 InfraInvestigationPort.collect(monitoringEvent) を呼び出してインフラ証拠を収集する（v12）
   → infraEvidence: InfraEvidence | undefined
   ├─ CloudLoggingGateway → アプリログ（エラー・警告）
   ├─ TerraformGateway    → plan / git diff（IaC変更履歴・読み取り専用）
   └─ GitHubGateway       → 直近コミット・PR一覧
   └─ 失敗時は infraEvidence を undefined にして調査を継続する（証拠収集はベストエフォート）

3. InvestigationContext を構築する（トークン上限 3,500 を意識する）
   {
     errorEvent: monitoringEvent,          // ~500トークン
     recentEvents: [],                     // 直近30分（今回は省略・将来拡張ポイント）
     systemSnapshot: null,                 // 今回は省略
     knownPatterns: [],                    // KnownErrorPatternRepository から取得（~500トークン）
     similarIncidents: similarIncidents,   // ~500トークン
     infraEvidence: infraEvidence,         // アプリログ + Terraform差分 + 直近コミット（~1,000トークン）
   }

4. AIInvestigationPort.investigate(context) を呼び出す
   └─ 失敗（Gemini APIエラー）→ Logger.write(ERROR) → fallbackReport を使用
      fallbackReport = {
        summary: 'AI分析に失敗しました。手動での確認をお願いします。',
        confidence: 0,
        severity: 'WARNING',
        investigationSteps: [],
        suggestedActions: ['手動で原因を確認してください'],
        suggestedPatternName: '',
        reviewStatus: 'PENDING_REVIEW',
        isFallback: true,
      }

5. const updatedAlert = alert.attachInvestigationReport(report) を呼び出す
   ※ イミュータブル設計。新しいAlertを返す
   ※ report.reviewStatus は PENDING_REVIEW で初期化される（レビュー待ち）
6. AlertRepository.save(updatedAlert) を呼び出す
7. SSEAlertNotifier.notify(updatedAlert.toPrimitives())  ← 分析完了をフロントにpush
8. Logger.write(INFO, 'alert_investigated', { alertId, confidence: report.confidence })
```

---

## InvestigationReport（Alert集約に埋め込むサブエンティティ）

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/domain/InvestigationReport.ts`

> step1 の設計判断に整合：「AIが調査して人間はレビューするだけ」という体験価値を実現するため、
> `investigationSteps`（AIが何を調べたか）・`suggestedActions`（推奨対応）・`reviewStatus`（承認/却下）を持つ。
> 分類ツールではなく**調査エージェント**として機能させるための核心フィールド。

```typescript
export class InvestigationReport {
  readonly summary: string; // 「DBコネクションプール枯渇の可能性87%」などの自然言語説明
  readonly confidence: number; // 0.0〜1.0（Geminiが返すconfidence）
  readonly severity: AlertSeverity; // GeminiがCRITICAL/WARNING/INFOを判定
  readonly investigationSteps: string[]; // AIが実施した調査ステップ（証拠の積み上げ過程を可視化）
  readonly suggestedActions: string[]; // 推奨対応アクション（箇条書き）
  readonly suggestedPatternName: string; // 自動昇格候補のパターン名（Geminiが提案）
  readonly reviewStatus: ReviewStatus; // PENDING_REVIEW / APPROVED / REJECTED
  readonly investigatedAt: Date;
  readonly isFallback: boolean; // Gemini APIエラー時のfallbackか

  constructor(params: { ... }) { ... }

  // イミュータブル更新（Alert.submitFeedbackで使用）
  withReviewStatus(reviewStatus: ReviewStatus): InvestigationReport { ... }

  toPrimitives(): InvestigationReportPrimitives { ... }
  static fromPrimitives(primitives: InvestigationReportPrimitives): InvestigationReport { ... }
}
```

### ReviewStatus（Value Object）

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/domain/ReviewStatus.ts`

```typescript
export enum ReviewStatuses {
  PENDING_REVIEW = "PENDING_REVIEW", // AI調査直後の初期値
  APPROVED = "APPROVED", // オペレーターが承認（= 正解フィードバック）
  REJECTED = "REJECTED", // オペレーターが却下
}

export class ReviewStatus extends EnumValueObject<ReviewStatuses> {
  static pendingReview(): ReviewStatus { ... }
  static approved(): ReviewStatus { ... }
  static rejected(): ReviewStatus { ... }
  static fromString(value: string): ReviewStatus { ... }
}
```

**設計ポイント**: `reviewStatus` は `attachInvestigationReport()` 時に `PENDING_REVIEW` で初期化し、
`SubmitFeedbackCommandHandler`（`PATCH /alerts/:id/feedback`）が承認/却下に更新する。
承認/却下フィードバックとパターン昇格フィードバックを同一エンドポイントで処理する（step1 準拠）。

---

## AIInvestigationPort インターフェース（DIP）

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/domain/AIInvestigationPort.ts`

```typescript
interface AIInvestigationPort {
  investigate(context: InvestigationContext): Promise<InvestigationReport>;
}
```

### InvestigationContext

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/domain/InvestigationContext.ts`

```typescript
interface InvestigationContext {
  readonly errorEvent: {
    eventName: string;
    occurredOn: string;
    payload: Record<string, unknown>;
  };
  readonly knownPatterns: Array<{
    name: string;
    description: string;
    eventNamePattern: string;
  }>;
  readonly similarIncidents: Array<{
    eventName: string;
    occurredOn: string;
    resolvedNote: string;
  }>;
  // インフラ横断調査の証拠（v12追加。Infrastructure生レスポンスを正規化済みのドメイン型）
  readonly infraEvidence?: InfraEvidence;
  // 将来拡張ポイント（今回は省略）
  // recentEvents?: MonitoringEvent[];
  // systemSnapshot?: SystemResourceSnapshot;
}
```

### AIInvestigationPort の段階移行（project-prompt v10 準拠）

ポート名にプロダクト名を含めないことで、Application層（`InvestigateAlertCommandHandler`）をノータッチにしたまま実装をDI差し替えできる。

```
AIInvestigationPort（インターフェース）← Application層が依存する抽象
  ├─ GeminiAIInvestigationAdapter   ← フェーズ0：ハッカソン本体（Gemini API直接 / @google/generative-ai）
  ├─ VertexAIInvestigationAdapter   ← フェーズ1：Vertex AI SDK経由（@google-cloud/vertexai。推奨経路）
  └─ ADKAgentInvestigationAdapter   ← フェーズ2：ADKエージェント構成（A2A統合）
```

切り替えは `EcBackendApp.ts` / backoffice 起動時のファクトリでの差し替え1箇所のみ。

### GeminiAIInvestigationAdapter（Infrastructure実装・フェーズ0）

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/infrastructure/GeminiAIInvestigationAdapter.ts`

```typescript
// 依存: @google/generative-ai
// モデル: gemini-2.0-flash 系（環境変数 GEMINI_MODEL で切り替え可能。コスト/レイテンシ優先）

// プロンプト構造（JSON返却を強制）
const systemPrompt = `
あなたはECシステムの障害調査AIエージェントです。
提供された障害イベント・既知パターン・類似インシデント・インフラ証拠（InfraEvidence）を分析し、
必ずJSONフォーマットで回答してください。
{
  "summary": "障害の説明（日本語・1〜2文）",
  "confidence": 0.87,
  "severity": "CRITICAL" | "WARNING" | "INFO",
  "investigationSteps": ["調べたこと1", "調べたこと2"],
  "suggestedActions": ["対応アクション1", "対応アクション2"],
  "suggestedPatternName": "自動昇格候補のパターン名（例: DB_CONNECTION_EXHAUSTION）"
}
`;
```

> `reviewStatus` / `investigatedAt` / `isFallback` はGeminiの出力ではなくAdapter/ドメイン側で付与する
> （`reviewStatus` は `PENDING_REVIEW` 固定、`isFallback` は `false`）。
> 出力は `safeParse` でスキーマ検証し、`confidence` は 0.0〜1.0 にクランプ、タイムアウト時は1回リトライする。

**トークン管理**:

- `InvestigationContext` のシリアライズ後のトークン数を推定し、3,500トークンを超えないように `similarIncidents` 件数を動的に削減する
- 超過する場合は `similarIncidents` を0件にフォールバックする

---

## インフラ横断調査パイプライン（v12追加）

AIエージェントを「アプリログのみを見る分類器」ではなく、**複数のインフラ情報ソースを自律的に横断して証拠を収集し、根拠付きで原因を推定する調査エージェント**として機能させる。これがElastic類似検索と競合しない**別レイヤー**であり、証拠が太るほど類似検索・AI推定の精度が上がるシナジー関係にある。

```
Alert発生
  ↓
【レイヤー1：証拠収集】InfraInvestigationPort.collect()
  ├─ CloudLoggingGateway → アプリログ（エラー・警告）
  ├─ TerraformGateway    → plan / git diff（IaC変更履歴・読み取り専用）
  └─ GitHubGateway       → 直近コミット・PR一覧
  ↓ 収集した「障害コンテキスト」がリッチになるほど
【レイヤー2：事例照合】ElasticAlertClassifier / SimilarIncidentRepository
  └─ ハイブリッド検索（BM25 + ベクトル）で過去パターンと突合
  ↓
【レイヤー3：AI推定】AIInvestigationPort（GeminiAIInvestigationAdapter）
  └─ 証拠 + 照合結果を統合してGeminiに渡し、原因候補を生成
```

### InfraInvestigationPort（インターフェース）

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/InfraInvestigation/domain/InfraInvestigationPort.ts`

```typescript
interface InfraInvestigationPort {
  // 障害イベントを起点にインフラ証拠を横断収集する（読み取り専用・ベストエフォート）
  // monitoringEvent.category に応じて収集する証拠源を出し分ける
  collect(monitoringEvent: MonitoringEvent): Promise<InfraEvidence>;
}
```

**`category` による証拠源の出し分け**（実装は各Gatewayの呼び出し有無で制御）:

| category         | 厚めに収集する証拠源                                  |
| ---------------- | ---------------------------------------------------- |
| `APPLICATION`    | Cloud Logging（アプリログ）中心                      |
| `INFRASTRUCTURE` | Terraform差分 + Cloud Logging                        |
| `SECURITY`       | GitHub（npm audit結果・依存更新PR）                  |
| `CAPACITY`       | Cloud Monitoring メトリクス（次フェーズGateway）     |

### InfraEvidence（ドメイン型）

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/InfraInvestigation/domain/InfraEvidence.ts`

各Gatewayの生レスポンス型をMonitoringドメインに持ち込まず、正規化したドメイン型に変換してから渡す。

```typescript
interface InfraEvidence {
  readonly appLogs: AppLogEntry[]; // Cloud Loggingから収集したエラーログ
  readonly terraformDiff?: TerraformDiff; // Terraform差分（変更があった場合のみ）
  readonly recentCommits?: GitCommit[]; // 直近のコミット一覧
  readonly collectedAt: Date;
}
```

### Gateway 設計原則（必ず守る）

| Gateway                  | 取得内容                                     | ハッカソン必須 |
| ------------------------ | -------------------------------------------- | -------------- |
| `CloudLoggingGateway`    | アプリログ（エラー・警告）                   | ✅             |
| `TerraformGateway`       | `terraform plan` / `git diff`（IaC変更履歴） | ✅             |
| `GitHubGateway`          | 直近コミット・PR一覧                         | ✅（できれば） |
| `CloudMonitoringGateway` | CPU/メモリ等のメトリクス相関                 | 🔲 次フェーズ  |
| `CloudTraceGateway`      | 分散トレース                                 | 🔲 次フェーズ  |

- すべて Gatewayインターフェース経由でアクセスし、実装は Infrastructure層に閉じる（Domainは依存しない）
- **読み取り専用に徹する。`terraform apply` 等の書き込み操作メソッドは一切定義しない**
- Cloud Monitoring / Cloud Trace は「設計済み・次フェーズ実装」としてADRに明記する

### バックオフィスUIでの表示（証拠パネル）

`/alerts` のカード展開および `/alerts/:id` 詳細画面で「証拠一覧」として表示する。**AIが複数ソースを横断して証拠を積み上げていく過程を可視化**することがこのレイヤーの最大の価値。

```
証拠パネル
  ├─ Cloud Logging: "DB接続失敗 × 47件"
  ├─ Terraform:     "昨日 Cloud SQL 接続設定変更あり"
  └─ GitHub:        "PR #123 merged 2h ago: update db config"
    ↓
  AI推定: "Terraform変更による接続設定不整合の可能性 82%"
```

関連APIエンドポイント（project-prompt v12）:

```
GET /alerts/:id/evidence              ← 収集済みInfraEvidenceの取得
GET /alerts/:id/investigation/status  ← 調査ステータス（collecting / analyzing / done）
```

---

## AIInvestigationPort のマルチエージェント実装（ADK・フェーズ2）

`AIInvestigationPort` の裏側を、単一Gemini呼び出し（フェーズ0）から **ADK（Agents Development Kit）によるマルチエージェント構成**に差し替える。Application層（`InvestigateAlertCommandHandler`）はポートにのみ依存するため**ノータッチ**。a2a は使わず**1プロセス内**で完結する（a2aはStep3の異ベンダー相互運用用であり、本構成には不要）。

### マルチエージェントである必然性

固定パイプラインではなく、以下2点で「自律的な判断・実行」を満たす（審査基準1の核心）。

1. **専門エージェントの並列調査**: `category` でルーティングし、各レイヤーの analyst が**絞った文脈**で並走。競合する部分仮説をオーケストレータが突き合わせる（単なる要約ではなく複数の見立ての統合）。
2. **自律的な証拠追加収集ループ**: analyst が「次にこの証拠が要る」と*自分で判断*して `EvidenceCollector` を再起動する。固定手順ではなくエージェントが収集対象を決める点が agentic 価値の中心。

### 構成

```
InvestigationCoordinator（オーケストレータ）
  │  monitoringEvent.category でディスパッチ
  ├─▶ EvidenceCollectorAgent   ← Gatewayをtoolとして保持
  │     tools: CloudLoggingGateway / TerraformGateway / GitHubGateway（すべて読み取り専用）
  │     出力: InfraEvidence（正規化済みドメイン型）
  │
  ├─▶ RootCauseAnalystAgent    ← category別の専門プロンプト（app / infra / security）
  │     入力: InfraEvidence + similarIncidents + knownPatterns
  │     出力: 原因仮説 + confidence + investigationSteps
  │     ★ 証拠不足と判断したら Coordinator 経由で EvidenceCollector に追加収集を要求（ループ）
  │
  └─▶ RemediationPlannerAgent  ← suggestedActions / suggestedPatternName / 修正方針
        （SECURITYカテゴリでは修正PR草案まで生成。後述のRemediationPortへ）
        ↓
      Synthesizer → InvestigationReport（reviewStatus = PENDING_REVIEW）
```

| エージェント               | 責務                                       | tool / 依存                                  |
| -------------------------- | ------------------------------------------ | -------------------------------------------- |
| `InvestigationCoordinator` | ルーティング・サブエージェント統括・統合   | 各サブエージェント                           |
| `EvidenceCollectorAgent`   | 証拠の横断収集（read-only・ベストエフォート） | `InfraInvestigationPort` 配下の各Gateway     |
| `RootCauseAnalystAgent`    | 原因仮説の生成・確信度算出・追加収集の判断 | Gemini（category別プロンプト）               |
| `RemediationPlannerAgent`  | 推奨アクション・修正方針・PR草案の生成     | Gemini / `RemediationPort`（SECURITY時）     |

### トークン設計

各サブエージェントは自分のレイヤーの文脈のみを受け取るため、単一巨大プロンプト（≤3,500トークン）より**個々の入力が小さく集中する**。並列実行で総レイテンシも短縮。トークン上限管理は Coordinator がサブエージェントごとに配分する。

### ファイル配置

```
src/Contexts/Monitoring/AIInvestigation/infrastructure/
├── GeminiAIInvestigationAdapter.ts        # フェーズ0：単一呼び出し
├── VertexAIInvestigationAdapter.ts        # フェーズ1：Vertex AI SDK経由
└── adk/
    ├── ADKAgentInvestigationAdapter.ts    # フェーズ2：AIInvestigationPort実装（Coordinatorを起動）
    ├── InvestigationCoordinator.ts
    ├── EvidenceCollectorAgent.ts
    ├── RootCauseAnalystAgent.ts
    └── RemediationPlannerAgent.ts
```

> **段階方針**: フェーズ0（単一Gemini）で提出可能状態を確保し、ADK版は `ADKAgentInvestigationAdapter` を DI差し替えで載せる。途中で締切が来てもフェーズ0で提出できる。

---

## セキュリティインシデントと自律リメディエーション（CI/CD連携・v13追加）

「DevOps × AI Agent」の DevOps 半分を担うフロー。CI で検出した脆弱性を `MonitoringEvent`（`category: SECURITY`）として同一の調査パイプラインに流し、**AIが調査し修正PRを起票、人間がレビュー・承認**する。

### フロー

```
GitHub Actions（CIパイプライン）
  └─ Trivy / npm audit でHIGH以上の脆弱性を検出
       └─ POST /ingest/security-scan（CI → backoffice）
            └─ SecurityScanIngestController が MonitoringEvent(category=SECURITY) を構築
               ※ ECDomainEvent由来ではない。MonitoringEventがECと疎結合である設計の実証
                 → AnalyzeAlertCommandHandler（既存の調査パイプラインに合流）
                      └─ InvestigateAlert（ADK）
                          ├─ EvidenceCollector: GitHub Gatewayで利用箇所・依存グラフを収集
                          ├─ RootCauseAnalyst(security): CVE概要 / 影響範囲 / 修正版を分析
                          └─ RemediationPlanner: 修正方針 → RemediationPort.draftPullRequest()
                               └─ 人間が PR と reviewStatus をレビュー・承認/却下
```

### MonitoringEvent への直接マッピング（SECURITY）

| 発生源        | eventName                         | category   | source      | payloadのキー                                  |
| ------------- | --------------------------------- | ---------- | ----------- | ---------------------------------------------- |
| Trivy/npm audit | `security.vulnerability_detected` | `SECURITY` | `npm_audit` | cveId, severity, package, version, fixedVersion |

### RemediationPort（人間承認ゲート付きの write 操作）

**ファイルパス**: `src/Contexts/Monitoring/AIInvestigation/Remediation/domain/RemediationPort.ts`

```typescript
interface RemediationPort {
  // 修正PRを「草案」として起票する。マージはしない（人間がレビュー）
  draftPullRequest(plan: RemediationPlan): Promise<RemediationResult>;
}

interface RemediationPlan {
  readonly title: string;
  readonly branch: string;
  readonly fileChanges: Array<{ path: string; patch: string }>; // 例: package.json のバージョン更新
  readonly body: string; // CVE概要・影響範囲・根拠（InvestigationReportから生成）
}

type RemediationResult =
  | { created: true; pullRequestUrl: string }
  | { created: false; reason: string };
```

### 調査(read) と リメディエーション(write) の分離原則

- **InfraInvestigation の Gateway は read-only を厳守**（`terraform apply` 等を持たない）。
- **PR起票だけが write 操作**で、`RemediationPort` に隔離する。実装は `GitHubPullRequestGateway`（`GITHUB_TOKEN` 必須・対象リポジトリを環境変数で限定）。
- PRは**自動マージしない**。エージェントは「調査して草案を出す」、人間は「レビューして承認する」。この境界が「AIが調査・人間がレビュー」という体験価値（step1）をそのまま体現する。

### 関連エンドポイント

```
POST /ingest/security-scan             ← CIからの脆弱性スキャン結果受信（MonitoringEvent化）
POST /alerts/:id/remediation/draft-pr  ← 承認操作：RemediationPlanからPR草案を起票
GET  /alerts/:id/remediation           ← 起票済みPRのURL・ステータス取得
```

---

## フィードバックループの集約設計

### SubmitFeedbackCommandHandler

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/application/SubmitFeedback/SubmitFeedbackCommandHandler.ts`

### SubmitFeedbackCommand

```typescript
interface SubmitFeedbackCommand {
  readonly alertId: string;
  readonly isCorrect: boolean;
  readonly operatorNote?: string;
}
```

### 依存関係

| 依存                          | 種別      | 理由                                               |
| ----------------------------- | --------- | -------------------------------------------------- |
| `AlertRepository`             | interface | Alert取得・更新                                    |
| `KnownErrorPatternRepository` | interface | 自動昇格時のパターン保存                           |
| `SimilarIncidentRepository`   | interface | 正解時に解決済みインシデントとしてインデックス登録 |
| `Logger`                      | interface | 構造化ログ                                         |

### 自動昇格のしきい値

```typescript
const AUTO_PROMOTE_THRESHOLD = 3; // 正解フィードバック3回で自動昇格
```

環境変数 `FEEDBACK_AUTO_PROMOTE_THRESHOLD` でオーバーライド可能にする（デモ調整用）。

### 処理フロー

```
1. AlertRepository.findById(alertId) を呼び出す
   └─ null → ResourceNotFoundError をthrow

2. const updatedAlert = alert.submitFeedback({ isCorrect, operatorNote }) を呼び出す
   ※ イミュータブル設計。新しいAlertを返す

3. AlertRepository.save(updatedAlert) を呼び出す

【isCorrect === true の場合の追加処理】

4. SimilarIncidentRepository.index(
     new ResolvedIncident({
       eventName: updatedAlert.monitoringEvent.eventName,
       occurredOn: updatedAlert.monitoringEvent.occurredOn,
       resolvedNote: operatorNote ?? '正解フィードバックによる解決',
     })
   ) を呼び出す

5. updatedAlert.correctFeedbackCount >= AUTO_PROMOTE_THRESHOLD の場合:
   └─ 自動昇格処理

   5a. updatedAlert.classification.type === 'unknown' かつ investigationReport が存在する場合:
       新規 KnownErrorPattern を構築する:
       {
         id: uuid(),
         name: `AUTO_PROMOTED_${updatedAlert.monitoringEvent.eventName.toUpperCase()}`,
         description: updatedAlert.investigationReport.summary,
         eventNamePattern: updatedAlert.monitoringEvent.eventName,
         payloadConditions: [],          // 自動昇格は eventName のみでマッチ（安全側）
         severity: updatedAlert.investigationReport.severity,
         suggestedAction: updatedAlert.investigationReport.suggestedActions.join('\n'),
         isPromoted: true,
         promotedAt: new Date(),
       }
   5b. KnownErrorPatternRepository.save(newPattern) を呼び出す
   5c. Logger.write(INFO, 'pattern_auto_promoted', { alertId, patternName })

6. Logger.write(INFO, 'feedback_submitted', { alertId, isCorrect })
```

### 手動昇格（PatternPromotePostController経由）

`POST /patterns/:id/promote` は `KnownErrorPatternRepository.findById()` → `pattern.promote()` → `save()` のシンプルなフローで実装する。
`SubmitFeedbackCommandHandler` とは独立した `PromotePatternCommandHandler` として設計する。

---

## SimilarIncidentRepository インターフェースと InMemoryCriteriaConverter

### SimilarIncidentRepository

**ファイルパス**: `src/Contexts/Monitoring/SimilarIncident/domain/SimilarIncidentRepository.ts`

```typescript
interface SimilarIncidentRepository {
  findSimilar(criteria: Criteria): Promise<SimilarIncident[]>;
  index(incident: ResolvedIncident): Promise<void>;
}
```

### SimilarIncident エンティティ

**ファイルパス**: `src/Contexts/Monitoring/SimilarIncident/domain/SimilarIncident.ts`

```typescript
interface SimilarIncident {
  readonly id: string;
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly resolvedNote: string; // オペレーターのメモまたはAI分析summary
  readonly resolvedAt: Date;
}
```

### ResolvedIncident（インデックス登録用）

```typescript
interface ResolvedIncident {
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly resolvedNote: string;
}
```

### InMemorySimilarIncidentRepository

**ファイルパス**: `src/Contexts/Monitoring/SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.ts`

```typescript
class InMemorySimilarIncidentRepository implements SimilarIncidentRepository {
  private incidents: SimilarIncident[] = [];

  // 起動時ウォームアップ
  async warmUp(mongoIncidents: SimilarIncident[]): Promise<void>;

  async findSimilar(criteria: Criteria): Promise<SimilarIncident[]>;
  // InMemoryCriteriaConverter でフィルタ・ソートを適用する

  async index(incident: ResolvedIncident): Promise<void>;
  // incidents 配列の先頭に追加する（最新を先頭に保つ）
  // 上限100件超過時は末尾を削除する（メモリ管理）
}
```

### InMemoryCriteriaConverter

**ファイルパス**: `src/Contexts/Monitoring/SimilarIncident/infrastructure/InMemoryCriteriaConverter.ts`

```typescript
class InMemoryCriteriaConverter {
  convert(criteria: Criteria): {
    filter: (incident: SimilarIncident) => boolean;
    sort: (a: SimilarIncident, b: SimilarIncident) => number;
    limit: number;
  };
}
```

**対応するFilterOperator**:

| FilterOperator | 配列フィルタへの変換                              |
| -------------- | ------------------------------------------------- |
| `EQUAL`        | `incident[field] === value`                       |
| `CONTAINS`     | `String(incident[field]).includes(String(value))` |
| `GT`           | `incident[field] > value`                         |
| `LT`           | `incident[field] < value`                         |

ソートは `Criteria.order` を配列の `sort()` に変換する。
`Criteria.limit` が指定されている場合は `slice(0, limit)` で件数を絞る。

**設計ポイント**: `Criteria` / `Filter` / `FilterOperator` は `src/Contexts/Shared/domain/criteria/` のものをそのまま使用する。InMemory実装とMongoDB実装でCriteriaの型を統一することで、将来 `ElasticSearchSimilarIncidentRepository` へ差し替えても `findSimilar()` の呼び出し側はノータッチ。

---

## SSEAlertNotifier

### インターフェース

**ファイルパス**: `src/Contexts/Monitoring/ReportGeneration/infrastructure/SSEAlertNotifier.ts`

```typescript
interface SSEAlertNotifier {
  notify(alertPrimitives: AlertPrimitives): void;
  addConnection(res: Response): void;
  removeConnection(res: Response): void;
}
```

### EventEmitterSSEAlertNotifier（Infrastructure実装）

```typescript
class EventEmitterSSEAlertNotifier implements SSEAlertNotifier {
  private connections: Set<Response> = new Set();
  private emitter: EventEmitter = new EventEmitter();

  addConnection(res: Response): void {
    this.connections.add(res);
    res.on("close", () => this.removeConnection(res));
  }

  removeConnection(res: Response): void {
    this.connections.delete(res);
  }

  notify(alertPrimitives: AlertPrimitives): void {
    const data = JSON.stringify(alertPrimitives);
    for (const res of this.connections) {
      res.write(`data: ${data}\n\n`);
    }
  }
}
```

### AlertsStreamController との接合点

**ファイルパス**: `src/apps/backoffice/backend/src/controllers/AlertsStreamController.ts`

```
GET /alerts/stream

1. res.setHeader('Content-Type', 'text/event-stream') を設定する
2. res.setHeader('Cache-Control', 'no-cache') を設定する
3. res.setHeader('Connection', 'keep-alive') を設定する
4. SSEAlertNotifier.addConnection(res) を呼び出す
5. 30秒ごとにハートビート（コメント行）を送信する（接続維持）
   setInterval(() => res.write(': heartbeat\n\n'), 30_000)
6. req.on('close') で SSEAlertNotifier.removeConnection(res) を呼び出す
```

---

## AlertRepository インターフェース

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/domain/AlertRepository.ts`

```typescript
interface AlertRepository {
  save(alert: Alert): Promise<void>;
  findById(id: AlertId): Promise<Alert | null>;
  findByCriteria(criteria: Criteria): Promise<Alert[]>;
}
```

`GET /alerts` は `findByCriteria(new Criteria([]))` で全件取得（ハッカソンスコープ）。
将来の拡張: `createdAt DESC` ソート、ページネーション、severity フィルタ。

---

## KnownErrorPatternRepository インターフェース

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/domain/KnownErrorPatternRepository.ts`

```typescript
interface KnownErrorPatternRepository {
  save(pattern: KnownErrorPattern): Promise<void>;
  findById(id: string): Promise<KnownErrorPattern | null>;
  findAll(): Promise<KnownErrorPattern[]>;
}
```

`findAll()` は `createdAt ASC` でソートして返す（マッチング優先度の制御）。

---

## ログ出力ポイント一覧

| 出力箇所                                           | severity | action                       | message                                                |
| -------------------------------------------------- | -------- | ---------------------------- | ------------------------------------------------------ |
| `CollectMonitoringEventOnECDomainEvent` 受信       | DEBUG    | `monitoring_event_collected` | ECイベントをMonitoringEventに変換：{eventName}         |
| `AnalyzeAlertCommandHandler` 既知分類              | INFO     | `alert_classified_known`     | 既知パターン一致：{alertId}, pattern={patternName}     |
| `AnalyzeAlertCommandHandler` 未知分類              | WARN     | `alert_classified_unknown`   | 未知パターン：{alertId}, eventName={eventName}         |
| `InvestigateAlertCommandHandler` 完了              | INFO     | `alert_investigated`         | AI分析完了：{alertId}, confidence={confidence}         |
| `InvestigateAlertCommandHandler` Geminiエラー      | ERROR    | `ai_investigation_failed`    | Gemini APIエラー（fallback使用）：{alertId}            |
| `SubmitFeedbackCommandHandler` 完了                | INFO     | `feedback_submitted`         | フィードバック受付：{alertId}, isCorrect={isCorrect}   |
| `SubmitFeedbackCommandHandler` 自動昇格            | INFO     | `pattern_auto_promoted`      | 未知パターン自動昇格：{alertId}, pattern={patternName} |
| `InMemorySimilarIncidentRepository` ウォームアップ | INFO     | `similar_incident_warmup`    | ウォームアップ完了：{count}件                          |

---

## アプリケーション層のエラー定義（Monitoringコンテキスト）

| エラークラス            | 継承元                | 発生箇所                                          | errorHandlerの応答                                     |
| ----------------------- | --------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| `ResourceNotFoundError` | `ApplicationError`    | `SubmitFeedbackCommandHandler`（Alert未存在時）   | 404                                                    |
| `AIInvestigationError`  | `InfrastructureError` | `GeminiAIInvestigationAdapter`（API呼び出し失敗） | ※ CommandHandlerでcatchしfallback使用（500を返さない） |

`AIInvestigationError` はCommandHandler内でcatchしてfallbackレポートを生成するため、HTTP 500にはならない。障害分析AIの失敗がバックオフィスAPIの失敗に波及しない設計。

---

## 集約間フロー全体図（Step 4 完全版）

```
[EC Backend] ──RabbitMQ──▶ [Backoffice Backend]

CollectMonitoringEventOnECDomainEvent
  │  ECDomainEvent → MonitoringEvent 変換
  ↓
AnalyzeAlertCommandHandler
  │
  ├─ KnownErrorPatternRepository.findAll()
  ├─ AlertClassifier.classify()
  │
  ├─【既知】Alert.createFromKnownPattern()
  │         AlertRepository.save()
  │         SSEAlertNotifier.notify()  ──▶ フロント（即時・1秒以内）
  │
  └─【未知】Alert.createAsUnknown()
            AlertRepository.save()
            SSEAlertNotifier.notify()  ──▶ フロント（「分析中」で即時push）
            │
            ↓（RabbitMQ経由 or 直接呼び出し）
            InvestigateAlertCommandHandler
              │
              ├─ InfraInvestigationPort.collect()  ──▶ Cloud Logging / Terraform / GitHub（証拠収集）
              ├─ SimilarIncidentRepository.findSimilar()
              ├─ InvestigationContext 構築（≤3,500トークン・InfraEvidence含む）
              ├─ AIInvestigationPort.investigate()  ──▶ Gemini API
              │
              Alert.attachInvestigationReport()  ──▶ reviewStatus = PENDING_REVIEW
              AlertRepository.save()
              SSEAlertNotifier.notify()  ──▶ フロント（分析結果push）

[フィードバックループ]
PATCH /alerts/:id/feedback
  ↓
SubmitFeedbackCommandHandler
  ├─ Alert.submitFeedback()
  ├─【isCorrect】SimilarIncidentRepository.index()
  └─【3回到達】KnownErrorPatternRepository.save()（自動昇格）
       ↓
       次回同じイベント → AlertClassifier.classify() で即座に既知分類（1秒以内）
```

---

## 将来の拡張ポイント（設計上の配慮）

| 拡張ポイント                           | 今回の設計                                                   | 将来の差し替え                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SSEAlertNotifier`                     | EventEmitterオンメモリ                                       | `RedisSSEAlertNotifier`（プロセス複数化時）。インターフェースは維持                                                                                                                                                                                                            |
| `SimilarIncidentRepository`            | InMemory + InMemoryCriteriaConverter                         | `ElasticSearchSimilarIncidentRepository`（大規模化時）。Criteria共通インターフェースは維持                                                                                                                                                                                     |
| `AIInvestigationPort`                  | GeminiAIInvestigationAdapter（gemini-2.0-flash系・Gemini API直接） | `VertexAIInvestigationAdapter`（Vertex AI SDK経由・推奨） → `ADKAgentInvestigationAdapter`（ADK/A2A構成）への段階移行。DI差し替え1箇所のみでApplication層ノータッチ（project-prompt v10）                                                                                       |
| `InfraInvestigationPort`               | CloudLogging/Terraform/GitHub の3Gateway（読み取り専用）     | `CloudMonitoringGateway` / `CloudTraceGateway` を追加（次フェーズ）。`InfraEvidence` の正規化スキーマは維持（project-prompt v12）                                                                                                                                              |
| `AlertClassifier`                      | `InMemoryAlertClassifier`（first-match、confidence 1.0固定） | `ElasticAlertClassifier`（hybrid search）→ `ScoringAlertClassifier`（重み付けスコア合算、閾値判定）。`AlertClassificationResult` の型は変わらず、`KnownAlertClassification` VOに `unmatchedConditions` の反証情報が入るようになる。移行トリガー: 自動昇格パターンが10件超 or 誤分類率が計測可能になった時点（ADR Step 5） |
| `recentEvents` in InvestigationContext | 省略（将来拡張ポイント）                                     | AlertRepository.findByCriteria で直近30分のAlertを収集し追加                                                                                                                                                                                                                   |

---

## 予兆ブリーフィング（stretchⅡ・reactive → proactive）

> **位置づけ**: P0 ＋ P1 ＋ 既存stretch（ADK）着地後の capstone。戦略・差別化・段階設計の全体像は `step4-1-strategy.md` 7章。本節は **Monitoringコンテキストの domain / application / infrastructure** の設計に限定する。
> **大原則**: 既存の反応的パイプライン（AnalyzeAlert/InvestigateAlert）は**一切変更しない**。予兆は新規 `ForecastRiskCommandHandler` として横に生やす（write無し＝read-onlyの調査の一種）。突合キーは **(B) 構造化タグ方式**を採用（`step4-1` 7.4）。

### 設計判断メモ（予兆）

| 判断項目 | 決定内容 | 理由 |
| -------- | -------- | ---- |
| Alertに相乗りさせない | `RiskForecast` を独立した read-model にする | 予報は起点MonitoringEventが無く・未発生で・reviewStatusの意味も違う。Alert集約に混ぜると不変条件が壊れる |
| 突合（join）の実装場所 | 自前ルールエンジンを作らず **LLMに委譲**。人間は「正規化／引用縛り／引用検証」の3点足場のみ | コンポーネント分類体系＋相関ロジックはブリットル。joinはモデルの得意領域 |
| 突合キーの構造化 | (B) 過去インシデントに `subject`（コンポーネントラベル）を構造化付与（`ForecastMemory` projection） | テキストjoin(A)より引用検証が安定。将来移行の物語もADR化できる |
| 予測の構成 | 統計MLでなく **既知未来シグナル × 記憶 のLLM推論** | データ大量を要さず、デモ規模で成立。レッドオーシャン回避 |
| write境界 | 予兆も read-only。リメディエーションが要る場合は既存 `RemediationPort`（人間承認ゲート）を再利用 | 「AIが調査・人間が承認」の構造を予兆でも崩さない |

### ドメイン型（完全新規・既存無傷）

**ファイルパス**: `src/Contexts/Monitoring/Forecast/domain/`

```typescript
// ForecastSignal.ts ── 異種ソースを共通の突合軸に正規化する器
interface ForecastSignal {
  readonly id: string;            // "chg-1" / "sch-1" / "inc-7"（citationsで参照される）
  readonly kind: ForecastSignalKind; // FUTURE_CHANGE | SCHEDULE | MEMORY
  readonly subject: string;       // 突合キー（例: "db.connection_pool" / "checkout"）
  readonly when: string;          // 時間窓（例: "Fri merge予定" / "Sat 20:00-23:00"）
  readonly desc: string;          // 要約（例: "max_connections 100→40に縮小"）
  readonly source: string;        // "github.pr#123" / "schedule.seed" / "incident.7"
}

const ForecastSignalKind = {
  FUTURE_CHANGE: "FUTURE_CHANGE", // 未マージPR / 未適用plan
  SCHEDULE: "SCHEDULE",           // 業務/負荷スケジュール
  MEMORY: "MEMORY",               // 過去インシデント（ForecastMemory由来）
} as const;

// RiskForecast.ts ── 出力（read-model）。Alertではない
interface RiskItem {
  readonly window: string;        // "Sat 20:00"
  readonly subject: string;       // "db.connection_pool"
  readonly level: RiskLevel;      // HIGH | MEDIUM | LOW
  readonly confidence: number;    // 0.0〜1.0（クランプ）
  readonly citations: string[];   // 使ったForecastSignal.id（空は不正＝検証で落とす）
  readonly reasoning: string;     // 引用を踏まえた根拠文
}

interface RiskForecast {
  readonly forecastId: string;
  readonly generatedAt: Date;
  readonly horizon: string;       // "今週末" など対象期間
  readonly risks: RiskItem[];     // level降順
  readonly isFallback: boolean;   // 生成失敗時の縮退
}
```

```typescript
// Schedule.ts ── 現状どこにも無い概念（完全新規）
interface ScheduleWindow {
  readonly subject: string;       // "checkout"
  readonly when: string;          // "Sat 20:00-23:00"
  readonly load: string;          // "x5 (セール)"
}
// ScheduleSource.ts（domain interface・read-only）
interface ScheduleSource {
  list(horizon: string): Promise<ScheduleWindow[]>;
}
```

### 記憶の突合キー（(B) ForecastMemory projection）

**ファイルパス**: `src/Contexts/Monitoring/Forecast/domain/ForecastMemory.ts` ＋ `infrastructure/`

過去の Resolved Alert / SimilarIncident を **`subject`（コンポーネント）でタグ付けした投影**として構築する。タグは `InvestigationReport.suggestedPatternName` ＋ `category` ＋ `InfraEvidence`（terraform resource / 影響コンポーネント）から導出する。

```typescript
interface ForecastMemoryEntry {
  readonly incidentId: string;
  readonly subject: string;       // ★突合キー（例: "db.connection_pool"）
  readonly trigger: string;       // "pool縮小+高負荷"
  readonly outcome: string;       // "接続枯渇 502"
}
interface ForecastMemoryRepository {
  warmUp(): Promise<void>;            // 起動時に Resolved から投影
  findBySubjects(subjects: string[]): Promise<ForecastMemoryEntry[]>;
}
```

> **既存への影響**: `InvestigationReport` に optional `subject?: string` を**追記**（後方互換）。`InvestigateAlertCommandHandler` で導出して埋める。これだけが既存P0設計への唯一の変更点。

### Gateway 追記（既存に read-only メソッドを追加）

既存の `GitHubGateway` / `TerraformGateway`（`AIInvestigation/InfraInvestigation/domain/`・全て読み取り専用）に**未来シグナル取得メソッドを追加**する。read-onlyの原則は崩さない。

```typescript
interface GitHubGateway {
  listRecentCommits(...): Promise<...>;        // 既存（過去）
  listOpenPullRequests(): Promise<OpenPr[]>;   // ★追加（未マージ＝未来）
}
interface TerraformGateway {
  getAppliedDiff(...): Promise<...>;           // 既存（適用済み）
  getPendingPlan(): Promise<PendingPlan[]>;    // ★追加（未適用＝未来）
}
```

### ForecastPort ＋ Gemini アダプタ

**ファイルパス**: `Forecast/domain/ForecastPort.ts` / `infrastructure/GeminiForecastAdapter.ts`

```typescript
interface ForecastContext {
  readonly horizon: string;
  readonly signals: ForecastSignal[];  // FUTURE_CHANGE + SCHEDULE + MEMORY を正規化済み
}
interface ForecastPort {
  forecast(context: ForecastContext): Promise<RiskForecast>;
}
```

`GeminiForecastAdapter` は既存 `GeminiAIInvestigationAdapter` のパターンを踏襲（`@google/generative-ai`・JSON固定出力・safeParse・confidenceクランプ・タイムアウト1回リトライ・fallback）。**プロンプトで `citations` 必須を強制**し、出力スキーマに `citations: string[]` を固定。

### ForecastRiskCommandHandler（オーケストレーション）

**ファイルパス**: `Forecast/application/ForecastRisk/ForecastRiskCommand.ts` / `ForecastRiskCommandHandler.ts`

```
1. 未来シグナル収集:
     GitHubGateway.listOpenPullRequests() / TerraformGateway.getPendingPlan()
     ScheduleSource.list(horizon)
2. subject 抽出 → ForecastMemoryRepository.findBySubjects(subjects)
3. 全て ForecastSignal[] に正規化（FUTURE_CHANGE / SCHEDULE / MEMORY）
4. ForecastContext 構築 → ForecastPort.forecast()
5. ★引用検証: 各 RiskItem.citations が手順3のシグナルidに実在するか照合。
     実在しない引用 → そのリスクを落とす or isFallback フラグ（ハルシネーション・ガード）
6. RiskForecast を保存（最小実装はメモリ最新保持）→ SSEAlertNotifier.notify()（任意）
```

依存: GitHubGateway / TerraformGateway / ScheduleSource / ForecastMemoryRepository / ForecastPort / Logger（全て read-only。write無し）。

> デモシナリオ6: seed（過去2-3件＋ステージ未マージPR＋スケジュール）→ `POST /forecast` → 引用付きリスク予報をライブ生成（録画）。`step4-3` の API、`step4-4` の ForecastPanel と結線。
