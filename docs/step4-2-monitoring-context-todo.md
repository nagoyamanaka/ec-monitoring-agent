# Step 4-2 TODO: Monitoring コンテキスト実装

> 対応設計: `docs/step4-2-monitoring-context.md`
> このスコープが最重要・最大。**依存順**に並べ、優先度: **P0必須**（提出ライン） / **P1差別化** / **stretch**。
> 各タスク完了ごとにコミット。P0が全部通れば「提出可能」状態。
>
> **実装プロンプト雛形**（各タスクで使う）:
> 「`/home/shigeyasu/Project/ec-monitoring-agent` の TypeScript DDD プロジェクトで、下記ファイルを新規作成。CodelyTV パターン準拠（AggregateRoot/DomainEvent/VO/CommandHandler）。参考: `docs/step4-2-monitoring-context.md` の該当節。テストは隣にコロケーション（`*.test.ts`）。」
>
> **application 層の実装方針（共通・全タスク適用）**:
>
> - **handler / subscriber は薄く保ち、ロジック本体は UseCase に移す**。`CommandHandler.handle()` / `DomainEventSubscriber.on()` の責務は「primitives → VO/ドメイン型への変換」と「UseCase への委譲」だけ。分岐・永続化・publish・通知・ログ等の実装は `XxxUseCase.run()` に置く
> - 理由: handler はフレームワーク境界（コマンドバス/イベントバス）への適合層。ロジックを UseCase に集約すると、バス機構を介さず fake 注入で直接ユニットテストでき、源（コマンド/イベント/HTTP）が変わっても本体を再利用できる
> - 参考実装: `EC/Orders/.../PlaceOrderCommandHandler`（→ `PlaceOrderUseCase`）/ `AnalyzeAlertCommandHandler`（→ `AnalyzeAlertUseCase`）/ `CollectMonitoringEventSubscriber`（→ `CollectMonitoringEventUseCase`）
> - テストは UseCase 側に書く（handler/subscriber 自体は変換のみなので原則テスト不要）
>
> **テスト方針**:
>
> - `type` / `as const` 定義のみのファイルはテスト不要
> - ドメイン制約（範囲検証・不変条件）や振る舞い（状態遷移・集計ロジック）があるものだけテストを書く
> - 例: `ClassificationConfidence.of()` の範囲制約、`Alert` の状態遷移メソッド、`EnumValueObject`クラスの`fromString()`バリデーション等は対象

---

## P0: 提出ライン（フェーズ0）

### タスク 1: MonitoringEvent ＋ category 〔P0〕✅ 完了済み

- 【完了】`src/Contexts/Monitoring/Shared/domain/MonitoringEvent.ts` - classとして実装、toPrimitives/fromPrimitives付き
- 【完了】`src/Contexts/Monitoring/Shared/domain/MonitoringEventCategory.ts` - EnumValueObjectクラスとして実装（APPLICATION/INFRASTRUCTURE/CAPACITY/SECURITY）
- ECの型を直接importしない。`payload: Record<string, unknown>`
- 参考: 「MonitoringEvent」「category の役割」節

### タスク 2: Alert 集約 ＋ VO 〔P0〕✅ 完了済み

- 【完了】`Alert.ts` / `AlertId.ts`(Uuid) / `AlertSeverity.ts`(CRITICAL/WARNING/INFO) / `AlertStatus.ts`(OPEN/ANALYZING/RESOLVED)
- ファクトリ: `createFromKnownPattern` / `createAsUnknown`、メソッド: `attachInvestigationReport`（イミュータブル・Alert返却）/ `submitFeedback`（イミュータブル・Alert返却）/ `toPrimitives`/`fromPrimitives`
- 参考: 「Alert集約」節

### タスク 3: AlertClassification VO 〔P0〕✅ 完了済み

- 【完了】`AlertClassification.ts`: `ClassificationConfidence`（クラス・0〜1制約・`certain()`/`isHighConfidence()`）、`MatchedCondition`/`UnmatchedCondition`（type）、`Known`/`Unknown` union
- `KnownAlertClassification`に`severity: AlertSeverity`を含む（KnownErrorPattern非依存設計）
- 重みはVOに持たせない（Classifier内部）。参考: 「AlertClassification」節

### タスク 4: KnownErrorPattern ＋ シード 〔P0〕✅ 完了済み

- 【新規】`KnownErrorPattern.ts` / `PayloadCondition`
- シード4件（PAYMENT_TIMEOUT / INVENTORY_INSUFFICIENT / INVENTORY_CONCURRENT_CONFLICT）。`PAYMENT_TIMEOUT_NO_ORDER` は作らない（到達不能）
- 参考: 「KnownErrorPattern」「シードデータ」節

### タスク 5: 分類アーキテクチャ（Classifier/Policy/Rule 3層）〔P0〕✅ 完了済み

- 【完了】`domain/classification/AlertClassifier.ts`（IF・`classify(event): Promise<AlertClassificationResult>`）
- 【完了】`domain/classification/ClassificationPolicy.ts`（IF・`supports`/`classify`）/ `ClassificationRule.ts`（IF・`classify(event): Promise<KnownAlertClassification|null>`）
- 【完了】`domain/classification/PolicyBasedAlertClassifier.ts`（category で Policy をディスパッチ）
- 【完了】`domain/classification/policies/ApplicationClassificationPolicy.ts`（first-match で Rule を集約）
- 【完了】`domain/classification/rules/KnownPatternRule.ts`（`KnownErrorPatternRepository` 内包・完全一致・confidence 1.0・unmatched空）
- 【完了】`domain/classification/ClassificationRuleKind.ts`（EXACT_MATCH/SIMILARITY/INFERENCE）/ `ClassificationRuleSorter.ts`（kind優先順位で並べ替えるドメインサービス）
- 【完了】`domain/KnownErrorPatternRepository.ts`（IF・`findAll`/`save`）/ `infrastructure/persistence/InMemoryKnownErrorPatternRepository.ts`
- 設計判断: 分類対象は MonitoringEvent（Alertではない）。各 Rule が依存を内包するので Elastic/AI も同一 IF に収まる（旧 `AlertClassificationAlgorithm` は廃止）
- 設計判断: ルール優先度は `ClassificationRuleSorter` が **kind 優先順位**で確定（配列順に依存しない）。`priority` 数値は持たせない（属性=kindはRule・関係=優先順位はSorter に分離）。Sorter は kind しか見ないので **domain**（DIP を侵さない）。実行時のカスケード/ディスパッチは Policy/Classifier（ドメインサービス）
- 設計判断: 分類器グラフの組み立て（依存注入）は composition root＝**step4-3 の DI** の責務（P0 では専用 Factory を置かない）
- 参考: 「分類アーキテクチャ（Classifier / Policy / Rule の3層）」「ルール優先度の決定箇所」「KnownPatternRule」節

### タスク 6: Repository interface ＋ Mongo 実装 〔P0〕✅ 完了済み

- 【完了】`domain/AlertRepository.ts`（新規・`save`/`findById`/`findByCriteria`）
- 【完了】`domain/KnownErrorPatternRepository.ts`（`findById` 追加）/ `infrastructure/persistence/InMemoryKnownErrorPatternRepository.ts`（`findById` 追加・`persistence/` へ移動）
- 【完了】`infrastructure/persistence/MongoAlertRepository.ts` / `MongoKnownErrorPatternRepository.ts`（`MongoRepository` 継承）
- 【完了】`Alert` / `KnownErrorPattern` を `AggregateRoot` 継承（`MongoRepository<T extends AggregateRoot>` 型制約を満たすため）
- `findAll()` は createdAt ASC（マッチ優先度）。参考: 各Repository節

### タスク 7: AnalyzeAlertCommandHandler 〔P0〕✅ 完了済み

- 【完了】`application/AnalyzeAlert/AnalyzeAlertCommand.ts` / `AnalyzeAlertCommandHandler.ts`（VO変換のみ → UseCase委譲）
- 【完了】`application/AnalyzeAlert/AnalyzeAlertUseCase.ts`（ロジック本体。既知→`createFromKnownPattern`→save→SSE / 未知→`createAsUnknown`→save→SSE→`InvestigateAlertDomainEvent` publish）
- 【完了】`application/AnalyzeAlert/AnalyzeAlertUseCase.test.ts`（既知/未知 各シナリオのユニットテスト）
- 【完了】`domain/InvestigateAlertDomainEvent.ts`（EventBus 経由で InvestigateAlertOnAlertClassifiedUnknown をトリガー）
- 【完了】`AlertNotification/domain/SSEAlertNotifier.ts`（interface。実装はタスク13）
- 【完了】`infrastructure/persistence/InMemoryAlertRepository.ts`（テスト用）
- 依存: AlertRepository / AlertClassifier / EventBus / SSEAlertNotifier / Logger（※既知パターン取得は `KnownPatternRule` が内包するので UseCase は `KnownErrorPatternRepository` に依存しない）
- 設計判断: `SSEAlertNotifier` は interface なので `AlertNotification/domain/` に配置（infrastructure には実装 `EventEmitterSSEAlertNotifier` を置く）
- 参考: 「AnalyzeAlertCommandHandler」節（重複3a行は無し）

### タスク 8: CollectMonitoringEventOnECEventPublished 〔P0〕✅ 完了済み

- 【完了】`application/CollectMonitoringEvent/CollectMonitoringEventSubscriber.ts`（抽象基底・テンプレートメソッド：`on()`＝`useCase.run(toMonitoringEvent(event))`。源固有差分は `subscribedTo()`/`toMonitoringEvent()` のみ。将来の CI/infra 源は継承で追加＝OCP）
- 【完了】`application/CollectMonitoringEvent/CollectMonitoringEventOnECEventPublished.ts`（EC源アダプタ：基底を継承し EC DomainEvent → MonitoringEvent 変換のみ実装。`instanceof` 分岐で eventごとに変換）
- 【完了】`application/CollectMonitoringEvent/CollectMonitoringEventUseCase.ts`（源非依存：AnalyzeAlertCommand 生成 → ハンドラ委譲 → DEBUGログ、失敗は ERRORログ＋re-throw）＋ `CollectMonitoringEventUseCase.test.ts`
- 設計判断（フォルダ配置）: 収集（ingest）は AnalyzeAlert とは別責務のため `application/CollectMonitoringEvent/` に独立。UseCase は `AnalyzeAlert/AnalyzeAlertCommandHandler` に委譲するのみ（依存方向: CollectMonitoringEvent → AnalyzeAlert）
- 変換規則: OrderPlaced=subtotalAmount / ReservationFailed=+reservedProductIds / PaymentTimeout=aggregateId=paymentAttemptId,payload{orderId,customerId,amount}（category=APPLICATION）
- 設計判断: subscriber は薄く UseCase へ委譲（`CompensateOrderOnInventoryFailed` 準拠）。源境界は **source 単位**（EC=1アダプタ、strategy 8.3「各源固有の型に触れるのはここだけ」）。`SupportedECDomainEvent` union は型安全な源境界として保持（ファクトリ注入はせず、拡張は新サブクラスで吸収）
- 参考: 「変換規則表」「CollectMonitoringEvent」節 / strategy 8.3「観測フレーム境界」

### タスク 9: InvestigationReport ＋ ReviewStatus 〔P0〕✅ 完了済み

- 【完了】`AlertAnalysis/domain/InvestigationReport.ts` - classとして実装、withReviewStatus/toPrimitives/fromPrimitives付き
- 【完了】`AlertAnalysis/domain/ReviewStatus.ts` - EnumValueObjectクラスとして実装（PENDING_REVIEW/APPROVED/REJECTED）
- 設計判断（配置）: `InvestigationReport`/`ReviewStatus` は **Alert集約のサブエンティティ＝AlertAnalysisの所有物**なので `AlertAnalysis/domain/` に置く（当初 `AIInvestigation/domain/` だったが、`Alert→InvestigationReport→AlertSeverity` のモジュール循環依存になるため移動）。依存は `AIInvestigation → AlertAnalysis` の一方向に統一

### タスク 10: AIInvestigationPort ＋ LLMInvestigationAdapter / GeminiLLMClient 〔P0〕✅ 完了済み

- 【完了】`AIInvestigation/domain/AIInvestigationPort.ts` / `AIInvestigation/domain/InvestigationContext.ts`（`InfraEvidence` はタスク15まで `Record<string, unknown>` スタブ）
- 【完了】`AIInvestigation/domain/LLMTextClient.ts`（LLMへの最小契約 `generate(systemInstruction, prompt): Promise<string>`。プロバイダ抽象）
- 【完了】`AIInvestigation/infrastructure/aiinvestigation/LLMInvestigationAdapter.ts`（`AIInvestigationPort`実装・薄いオーケストレーション：プロンプト構築→LLM呼び出し→パース→マッピングを組み合わせるだけ）。命名は `...Service` がドメインサービスを想起させ infra のACL実装と紛らわしいため `LLMInvestigationAdapter` に変更
- 【完了】オーケストレーションの純関数を3モジュールに分離（SRP＋直接UT）: `InvestigationPromptBuilder.ts`（プロンプト構築・トークン3500予算・超過で similarIncidents 0件削減）／`LLMOutputParser.ts`（```json フェンス抽出＋スキーマ検証 `parseLLMOutput`）／`InvestigationReportMapper.ts`（confidenceクランプ[0,1]・severityマッピング・`InvestigationReport`生成・fallback）
- 【完了】`AIInvestigation/infrastructure/aiinvestigation/GeminiLLMClient.ts`（`LLMTextClient`実装・`@google/generative-ai`・Gemini固有呼び出し・30sタイムアウト1回リトライ）
- 【完了】ユニットテスト（`*.test.ts` コロケーション・計19ケース）: 3純関数モジュール直接＋`LLMInvestigationAdapter`（fake `LLMTextClient` 注入で 正常／例外→fallback／パース不能→fallback の全分岐）。**疎通主体のリポジトリ実装と違い分岐ロジックが厚いので E2E でなくユニットテストで担保**
- 【完了】`@google/generative-ai ^0.24.1` を workspace root に追加
- 設計判断（SRP・コンポジション）: 当初の単一 `GeminiAIInvestigationAdapter` がプロンプト整形・パース・マッピング・fallback・リトライ・SDK呼び出しを全部抱えSRP違反だったため、**プロバイダ非依存のオーケストレーション（`LLMInvestigationAdapter`）** と **プロバイダ固有の text-in/text-out（`LLMTextClient`/`GeminiLLMClient`）** に分割。継承（基底クラス）ではなく**コンポジション**（アダプタがLLMTextClientをDIで受け取る）を採用＝is-a不成立を回避・Geminiをモックせずフェイククライアントでアダプタ単体テスト可能・将来プロバイダ追加時の境界が固い。**リトライ／タイムアウトは `GeminiLLMClient` 側に寄せた**（呼び出しの信頼性はインフラの関心事）。これに伴いパース失敗時はリトライせず即fallback（旧実装はパース失敗でもリトライしていた点が挙動差分）
- 設計判断（依存方向）: `LLMInvestigationAdapter` は `InvestigationReport`/`ReviewStatus`/`AlertSeverity` を **`AlertAnalysis/domain/` から import**（タスク9の移動に伴う）。Port/Context/LLMTextClient 自体は `AIInvestigation/domain/` のまま。依存は `AIInvestigation → AlertAnalysis` の一方向で循環なし。InvestigateAlertOnAlertClassifiedUnknown（タスク11）も同方向で `AlertRepository`/`Alert` に依存するので情報取得に問題なし
- 参考: 「AIInvestigationPort」「LLMTextClient」「LLMInvestigationAdapter ＋ GeminiLLMClient」節

### タスク 11: InvestigateAlertOnAlertClassifiedUnknown 〔P0〕✅ 完了済み

- 【完了】`AIInvestigation/application/InvestigateAlert/InvestigateAlertOnAlertClassifiedUnknown.ts`（`DomainEventSubscriber<InvestigateAlertDomainEvent>`。`subscribedTo()`＝`[InvestigateAlertDomainEvent]` / `on()`＝event→VO変換 → UseCase委譲。`CollectMonitoringEventOnECEventPublished` / `ReserveInventoryOnOrderPlaced` 準拠）
- 【完了】`AIInvestigation/application/InvestigateAlert/InvestigateAlertUseCase.ts`（ロジック本体）＋ `InvestigateAlertUseCase.test.ts`（Alert不在で冪等skip／正常系→OPEN保存＋SSE＋類似インシデントがContext流入／例外→fallbackレポート の全分岐を fake注入でUT・5ケース）
- フロー: findById（null→WARN→return＝冪等）→ SimilarIncident.findSimilar（eventName一致・最大5件）→（InfraInvestigation.collect: P1で結線、P0はskip）→ Context構築（knownPatterns/infraEvidenceはP0で空）→ Port.investigate（例外時はERRORログ＋fallbackレポート継続）→ attachReport → save → SSE notify → INFOログ
- 依存: AlertRepository / SimilarIncidentRepository / (InfraInvestigationPort) / AIInvestigationPort / SSEAlertNotifier / Logger
- 設計判断（CommandHandler → DomainEventSubscriber に責務統合）: `AnalyzeAlertUseCase` は未知時に `InvestigateAlertDomainEvent` を **EventBus に publish** する。これを受ける口は本来「DomainEvent を購読する DomainEventSubscriber」であって CommandBus 経由の CommandHandler ではない。当初の `InvestigateAlertCommand` + `InvestigateAlertCommandHandler`（二段ホップ＝DomainEvent→Command→CommandHandler）を廃止し、**購読側に一本化**。`CommandHandler.subscribedTo(): Command` と `DomainEventSubscriber.subscribedTo(): Array<DomainEventClass>` は **シグネチャが衝突し両立できない**ため、別 Subscriber クラスを足すのでなく本タスクの責務を「DomainEvent を直接購読して UseCase へ委譲する」に拡張した。`InvestigateAlertCommand.ts` は削除
- 設計判断（配置）: 設計書どおり `AIInvestigation/application/InvestigateAlert/` に配置（依存方向 `AIInvestigation → AlertAnalysis` 一方向を維持。`Alert`/`AlertRepository`/`InvestigationReport`/`InvestigateAlertDomainEvent` 等は `AlertAnalysis/domain` から import）
- 設計判断（薄いsubscriber）: `on()` は VO変換のみでロジックは UseCase に集約（共通方針。下記「application 層の実装方針」参照）
- 配線: composition root（step4-3 タスク8 `BackofficeSubscribers`）で `EventBus.addSubscribers()` に登録して結線する
- 前提作成: タスク12の依存先のうち**ドメインIFのみ先行作成**＝`SimilarIncident/domain/SimilarIncident.ts`（型）/ `SimilarIncidentRepository.ts`（IF・`findSimilar`/`index`＋`ResolvedIncident`）。InMemory実装（`warmUp`/`InMemoryCriteriaConverter`）は**タスク12に残置**
- 参考: 「InvestigateAlertOnAlertClassifiedUnknown」節

### タスク 12: SimilarIncident（InMemory）〔P0〕✅ 完了済み

- 【完了】`SimilarIncident/domain/SimilarIncident.ts`（`type`。純粋データ構造はinterfaceでなくtype）/ `SimilarIncidentRepository.ts`（IF + `ResolvedIncident` type）←タスク11でドメインIFは先行作成済み、タスク12でtype修正
- 【完了】`SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.ts`（warmUp/findSimilar/index・上限100・最新先頭）
- `InMemoryCriteriaConverter` は不要。`InMemoryCriteriaEvaluator`（Shared）を直接流用
- `findSimilar` は criteria に eventName EQUAL フィルタ＋limit で最大5件。`index` は先頭に追加、100件超で末尾削除
- 【追記】`SimilarIncident`/`ResolvedIncident` に optional `sourceAlertId?: string`（元解決済み Alert への back-link）を追加。InMemory/Elastic 両アダプタが index/projection で透過。Elastic は `sourceAlertId: { type: "keyword" }` をマッピングに追加し、未設定時はドキュメントに含めない。UI ディープリンクの土台（フロント側結線は step4-4 タスク 9b）／Forecast の citation incidentId 供給源（タスク 20）になる
- 参考: 「SimilarIncidentRepository」節

### タスク 13: SSEAlertNotifier interface ＋ EventEmitter 実装 〔P0〕✅ 完了済み

- 【完了】interface はタスク7で `AlertNotification/domain/SSEAlertNotifier.ts` に作成済み（IF はドメイン配置）。本タスクでは実装のみ追加
- 【完了】`AlertNotification/infrastructure/EventEmitterSSEAlertNotifier.ts`（`SSEAlertNotifier` 実装・オンメモリ Set<Response>・シングルプロセス前提）
- HTTP接続管理（addConnection/removeConnection/notify）。`addConnection` で `res.on("close")` 時に自動 removeConnection（冪等）。`notify` は全接続へ `data: <json>\n\n` を broadcast、1接続の write 失敗時はその接続を除去して継続
- 設計判断: 疎通主体の薄い infra アダプタのため UT はコロケーションせず E2E で担保（リポジトリ実装と同方針）。Express 側の routes/controller 配線は step4-3
- 参考: 「SSEAlertNotifier」節（EventEmitterSSEAlertNotifier）

### タスク 14: SubmitFeedback ＋ 自動昇格 / 手動昇格 〔P0〕✅ 完了済み

- 【完了】`AlertAnalysis/application/SubmitFeedback/SubmitFeedbackCommand.ts` / `SubmitFeedbackCommandHandler.ts`（VO変換のみ → UseCase委譲）
- 【完了】`AlertAnalysis/application/SubmitFeedback/SubmitFeedbackUseCase.ts`（ロジック本体）＋ `SubmitFeedbackUseCase.test.ts`（Alert不在→NotFound／不正解→index・昇格なし／正解→ResolvedIncident index＋sourceAlertId back-link／operatorNote無→investigationReport.summary を resolvedNote に充填／note・report 両無→汎用文字列フォールバック／しきい値未満→昇格なし／しきい値到達＋未知＋レポート→自動昇格／既知分類→昇格なし／レポート無→昇格なし の全分岐 9ケース）
- フロー: findById（null→`MonitoringResourceNotFoundError`）→ `alert.submitFeedback` → save →【isCorrect】SimilarIncident.index（`resolvedNote = operatorNote ?? investigationReport?.summary ?? '正解フィードバックによる解決'`・`sourceAlertId = alert.id.value`）＋ `correctFeedbackCount>=AUTO_PROMOTE_THRESHOLD` かつ unknown かつ investigationReport 有で `KnownErrorPattern.create(...).promote()` を save（自動昇格）→ INFOログ（feedback_submitted / pattern_auto_promoted）
- しきい値: `AUTO_PROMOTE_THRESHOLD=3`、env `FEEDBACK_AUTO_PROMOTE_THRESHOLD` で上書き可（UseCase コンストラクタ引数の既定値として注入。テストは明示注入で env 非依存）
- 【完了】`AlertAnalysis/application/PromotePattern/PromotePatternCommand.ts` / `PromotePatternCommandHandler.ts` / `PromotePatternUseCase.ts`（手動 `POST /patterns/:id/promote`：findById（null→NotFound）→ `pattern.promote()` → save → INFOログ pattern_promoted）＋ `PromotePatternUseCase.test.ts`（不在→NotFound／昇格→保存 2ケース）
- 【完了】`AlertAnalysis/application/errors/MonitoringResourceNotFoundError.ts`（`ApplicationError` 継承・404相当・Alert/Pattern 両方で再利用）
- 設計判断: 共通方針どおり handler は薄く（VO変換＋委譲のみ）、ロジックは UseCase に集約。SubmitFeedback と PromotePattern は責務独立のため別 UseCase/Handler。自動昇格は `KnownErrorPattern.create().promote()` で isPromoted=true・payloadConditions=[]（eventName のみマッチ＝安全側）
- 配線: composition root（step4-3）で CommandBus に登録。API ルートは step4-3
- 既知の簡略化（将来改善）: 自動昇格は `correctFeedbackCount >= N` の**固定回数**で、証拠の厚さ・confidence・fallback を無視している。証拠加重への改善は**タスク24（昇格判定の抽象化）＋タスク25（証拠加重スコア）**で対応
- 参考: 「フィードバックループの集約設計」節

> ✅ **ここまででデモシナリオ1・2・3がE2Eで通る。コミットを切り提出可能状態をキープ。**

---

## P1: 差別化（フェーズ1・1.5）

### タスク 15: InfraInvestigation（証拠収集）〔P1〕✅ 完了済み

- 【完了】`AIInvestigation/InfraInvestigation/domain/InfraEvidence.ts`（`AppLogEntry`/`TerraformDiff`/`GitCommit`/`InfraEvidence` を type で定義。旧 `InvestigationContext.ts` の `Record<string,unknown>` スタブを置換）
- 【完了】`AIInvestigation/InfraInvestigation/domain/InfraInvestigationPort.ts`（IF・`collect(event): Promise<InfraEvidence>`）
- 【完了】`domain/CloudLoggingGateway.ts` / `TerraformGateway.ts` / `GitHubGateway.ts`（各 Gateway interface・読み取り専用）
- 【完了】`infrastructure/DefaultInfraInvestigationAdapter.ts`（`InfraInvestigationPort` 実装。category で証拠源を出し分け: APPLICATION=CloudLogging / INFRASTRUCTURE=+Terraform / SECURITY=+GitHub。各 Gateway 呼び出しはベストエフォート try/catch）
- 【完了】`infrastructure/CloudLoggingGatewayImpl.ts`（スタブ・空配列返却。TODO: @google-cloud/logging 接続）
- 【完了】`infrastructure/TerraformGatewayImpl.ts`（`git log --name-only *.tf` で IaC 変更履歴を実収集。`TERRAFORM_REPO_PATH` 未設定時は null）
- 【完了】`infrastructure/GitHubGatewayImpl.ts`（GitHub REST API fetch。`GITHUB_TOKEN`/`GITHUB_REPO` 未設定時は空配列）
- 【完了】`InvestigateAlertUseCase` に `infraInvestigationPort: InfraInvestigationPort | null = null` を追加（オプショナル）。`buildInvestigationContext` で `collectInfraEvidence()` を `findSimilarIncidents()` と並列実行。失敗は WARN ログ＋undefined（調査継続）
- 【完了】`InvestigationContext.ts` を更新: `InfraEvidence` を `domain/InfraEvidence.ts` から re-export
- 設計判断: `infraInvestigationPort` は省略可能（null）にしてテストの破壊なし。既存 5ケースは全てパス。P0 は null のまま提出可能で P1 結線は composition root（step4-3）で差し込む
- タスク25連携（任意）: 証拠を `InvestigationReport` に `evidenceSourceCount` として永続化すると昇格スコア補助信号になる（主信号は タスク17 類似確度。証拠源数は任意加点）
- 参考: 「インフラ横断調査パイプライン」節 → デモシナリオ4

### タスク 16: Remediation（PR起票・write隔離）〔P1〕✅ 完了済み

- 【新規】`AIInvestigation/domain/remediation/RemediationPort.ts` / `RemediationPlan.ts`
- 【新規】`infrastructure/GitHubPullRequestGateway.ts`（GITHUB_TOKEN・対象repo限定・自動マージしない）
- SECURITYカテゴリの RemediationPlanner から呼ぶ。参考: 「セキュリティ＋自律リメディエーション」節

### タスク 17: SimilarPatternRule（Elastic 分類 Rule）〔P1/stretch〕✅ 完了済み

> **位置づけ（重要）**: これが「**graded confidence 付き分類**」の本体。学習を 0/1（未知/既知）でなく **probability low〜high の連続スペクトル**にするのはこのルール。正解フィードバックで蓄積された `SimilarIncident` を**分類段階で読み**、完全一致でなくても「過去のDB枯渇に82%類似・確度 中」のような確度を返す。**確度をレポートに出す＝意思決定支援**が価値の核（差別化テーブル「評価（confidence付き）」の実体）。現状 `SimilarIncident` は AI 調査の文脈強化にしか使われておらず、分類には未接続 → それを繋ぐのが本タスク。背景は `step4-1` 2章「学習ループ ①連続的な確度」。

- 【完了】`SimilarIncident/domain/SimilarIncidentRepository.ts`（**1インターフェースに統合**）: `findSimilar`(件数のみ・AI調査文脈)／`index`(追記)／`search(query): Promise<ScoredIncident[]>`(graded confidence 用スコア付き) ＋ `ScoredIncident{incident,score}`/`SimilarSearchQuery{eventName,text,limit}`。当初は別 Port（`SimilarIncidentSearchPort`）に分離したが、**同一クラスが両方実装し consumer も少ないため統合**（レビュー指摘）。`SimilarIncidentSearchPort.ts` は削除
- 【完了】`domain/classification/rules/SimilarPatternRule.ts`（`ClassificationRule` 実装・kind=`SIMILARITY`・`SimilarIncidentRepository.search` を内包・最類似ヒット採用→スコア正規化→`ClassificationConfidence`(0〜1)・閾値未満は null 棄権・`type:"known"` の graded 分類を返す）＋ `SimilarPatternRule.test.ts`（9ケース：棄権/閾値境界/最大採用/正規化/クランプ/severity/クエリ組立）。**分岐ロジックが厚いので fake 注入の UT で担保**
- 【完了】`SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.ts` に `search`(Jaccard 字句類似 [0,1]) を**追加**（独立アダプタ `InMemorySimilarIncidentSearchAdapter.ts` は廃止＝統合）。**Elastic 無しでもデモ/E2Eで graded confidence を通すフォールバック兼 application 層 UT 用**
- 【完了】`SimilarIncident/infrastructure/ElasticSimilarIncidentRepository.ts`（**本物の Elasticsearch アダプタ**・`SimilarIncidentRepository` を実装）。既存スキャフォルド `Shared/.../elasticsearch/`（`ElasticClientFactory`/`ElasticConfig`）に乗せて接続・index 自動生成。`findSimilar`=eventName 厳密一致(`.keyword` term)＋resolvedAt 降順／`index`=冪等追記／`search`=`multi_match`(eventName^2,resolvedNote, fuzziness AUTO) で**生 \_score** を返す（正規化は Rule）。`@elastic/elasticsearch@^7.17`（scaffold のレスポンス形に合わせ v7）を workspace root に追加
- 【完了】**死蔵スキャフォルド削除**: `ElasticRepository.ts`/`ElasticCriteriaConverter.ts` は誰も使っておらず（自己参照のみ）、`AggregateRoot` 制約＋スコア非対応（`_score` を捨てる）で SimilarIncident（type の projection）には不適合。これらが依存していた `bodybuilder`/`http-status`（未インストールの旧ライブラリ）ごと削除。新アダプタは最新クライアントの素のクエリオブジェクトで書くので両ライブラリ不要
- 【完了】実 ES コンテナで疎通検証済み（index→findSimilar→search→`SimilarPatternRule.classify` まで通し）。BM25 生スコアは短文 corpus だと max 数程度なので `scoreCeiling` を env で調整可能化（既定 5・`minConfidence` 既定 0.6）
- 【完了】docker-compose / Makefile: `elasticsearch`(7.17.18 single-node/security無効) を `docker-compose.yml` に追加＋`docker-compose.local.yml` で 9200 公開／`ELASTICSEARCH_URL` 注入／`es-data` volume／backoffice `depends_on` 健全待ち。`Makefile` の `infra-up`/`infra-down` に `elasticsearch` を追加（`make up`/`make e2e` で自動起動）。`.env.example`/`backoffice config.ts` に `ELASTICSEARCH_URL`/`*_INDEX`/`*_SCORE_CEILING`/`*_MIN_CONFIDENCE`
- 【完了】配線（composition root＝`BackofficeApp.buildSimilarIncidentRepository`）: `ELASTICSEARCH_URL` 設定時のみ ES リポジトリを `similarIncidentRepository` に使い `SimilarPatternRule` を policy へ追加。**未設定なら InMemory＝従来挙動（完全一致のみ）でE2E無傷**にする opt-in 方式。E2E はフィードバック投入が無く ES が空のまま＝`search` が常に空→Rule 棄権なので、ES 常時起動でも分類結果は不変。`AlertClassifier` IF も `AnalyzeAlertCommandHandler`/`AnalyzeAlertUseCase` もノータッチ（類似一致は `matched:true`→`createFromKnownPattern`→AI調査スキップ＝「準・既知」確度付き）
- UI/レポートで low/中/high バンド表示（`ClassificationConfidence.isHighConfidence()` 等）。`classification.confidence` フィールドは世代互換なので表示コードは不変
- 設計判断（スコア正規化の置き場）: 生スコアの尺度（BM25 は数十／cosine・RRF は 1 付近）は**バックエンド固有**なので、repository は生 `score` を返し、`SimilarPatternRule` が注入された `scoreCeiling`（飽和点）で `[0,1]` 正規化する。バックエンド尺度を domain に漏らさず、ceiling は composition root で調整可能（Sorter が kind しか見ない／リトライを GeminiLLMClient に寄せたのと同じ DIP 方針）
- 設計判断（severity）: 類似一致は重大度を断定できないため、コンストラクタ注入の既定 severity（既定 `WARNING`）を使う。AI調査/フィードバックが後で精緻化する
- 設計判断（patternId）: `similar:${incident.id}` 接頭辞で「KnownErrorPattern 参照ではなく解決済みインシデント参照」を明示。自動昇格は `classification.type==="unknown"` 限定なので類似一致(known)は誤昇格しない
- 設計判断（InfraEvidence クエリ強化は見送り）: `ClassificationRule.classify` は `MonitoringEvent` のみ受け取る契約。`InfraInvestigationPort` を rule に内包すると **AlertAnalysis→AIInvestigation の逆向き依存（既存は AIInvestigation→AlertAnalysis の一方向）でモジュール循環**になり、かつ分類ホットパス全件にインフラ収集レイテンシが乗る。よってクエリは eventName＋payload から組み立てる（InfraEvidence 強化は将来 Source 経由で別途検討）
- 将来改善: `search` は現状 `multi_match`(BM25 字句＋fuzziness) のみ。真のハイブリッド（kNN ベクトル併用）には embedding プロバイダが要るので別途。`scoreCeiling` の corpus 別自動較正、ES への ES_e2e シナリオ追加（現状はライブ疎通スクリプトで確認・UT は Rule 側で担保）も将来課題

### タスク 24: PatternPromotionPolicy 抽象化（昇格判定の差し替え可能化）〔P1〕✅ 完了済み

> 採番は末尾追加（既存タスクの相互参照を壊さないため番号据え置き）。位置づけは P1。タスク25の前提。
> 背景: 現状の自動昇格は `SubmitFeedbackUseCase` 内の `correctFeedbackCount >= AUTO_PROMOTE_THRESHOLD(=3)` 直書き。**全 Alert を等しく扱う固定回数判定**。まず判定ロジックを差し替え可能なドメインサービスに切り出す（式は次タスクで育てる）。分類側の `AlertClassifier`/`ClassificationPolicy`/`Rule` と**対称**の設計思想。
> 注: 「昇格＝学習」ではなく「頻出知識を完全一致の高速パスに焼き付ける結晶化」（`step4-1` 2章②）。連続的な確度は タスク17（SimilarPatternRule）が担う前提なので、本抽象化は**結晶化トリガーの差し替え口**という位置づけ。

- 【新規】`AlertAnalysis/domain/promotion/PatternPromotionPolicy.ts`（IF・`shouldPromote(alert: Alert): boolean`）
- 【新規】`AlertAnalysis/domain/promotion/FixedThresholdPromotionPolicy.ts`（現挙動を移植：`correctFeedbackCount >= N` かつ unknown かつ investigationReport 有・`!isFallback`。`N` は env `FEEDBACK_AUTO_PROMOTE_THRESHOLD` で注入）
- 【修正】`SubmitFeedbackUseCase`：`>= N` 直書きを `promotionPolicy.shouldPromote(updatedAlert)` 呼び出しに置換（DI で受け取る）。**挙動は不変**＝リファクタのみ・既存テスト緑のまま
- 設計判断: 「いつ昇格するか（判定）」と「どう昇格するか（KnownErrorPattern 構築・save・ログ）」を分離。判定をドメインへ、構築は UseCase に残す。低コストで今でも入れられ、式の進化を吸収する受け皿になる
- テスト: `FixedThresholdPromotionPolicy` の分岐（回数未満／到達／既知分類除外／fallback除外／report無除外）をユニットテスト

### タスク 25: EvidenceWeightedPromotionPolicy（結晶化ゲートの加重化）〔P1・低優先〕✅ 完了済み

> 採番は末尾追加（位置づけ P1・**低優先**）。**タスク24（抽象化）に依存。主たる証拠信号は タスク17（類似確度）**（旧版はタスク15依存と書いていたが、下記の整理で主信号を類似確度に変更）。
> **位置づけの再整理（重要）**: 昇格は「学習そのもの」ではなく、`step4-1` 2章 ②「**頻出が確定した知識を完全一致の高速パスに焼き付ける結晶化**」。連続的な確度は タスク17（SimilarPatternRule）が担うので、**昇格しきい値の微調整は correctness クリティカルではない**（未昇格でも類似確度で「準・既知」分類されるため、未知に取り残されない）。よって本タスクは「結晶化ゲートを賢くする最適化」＝**nice-to-have**。タスク17 実装後に効果を測ってから着手可。
> 狙い: 「類似確度が高く頻出が確定したものは feedback 1 回でも焼き付け、確度が低ければ複数回要求」。固定回数 → 加重スコアへ。

- 【完了】`AlertAnalysis/domain/promotion/EvidenceWeightedPromotionPolicy.ts`（`PatternPromotionPolicy` 実装）＋ `EvidenceWeightedPromotionPolicy.test.ts`（後方互換2／確度加重4／ハード除外3／重み注入1 の全分岐 10ケース。**分岐ロジックなので fake不要の純ドメインUT**）
  - スコア式: `score = humanWeight(correctFeedbackCount) + confidenceWeight(report.confidence)`、`score >= promoteThreshold(=1.0)` で昇格
  - 重み（`DEFAULT_EVIDENCE_WEIGHTS`・`Partial<EvidenceWeights>` でコンストラクタ注入＝env非依存テスト可）: correct 1回=+0.4（3回単独で 1.2≥1.0＝**FixedThreshold(3) と一致**）／確度≥0.8=+0.3・≥0.6=+0.1／`type!=="unknown"`・report無・`isFallback`=ハード除外
  - 例: 高確度 0.85（+0.3）→ feedback 2回（+0.8）で 1.1≥1.0 で焼き付け（低確度なら従来どおり3回要求）。**「似ている度が高いほど少ない確認で結晶化」**
- 設計判断（**二次信号の出どころ**＝当初設計の修正点）: 昇格候補は常に `classification.type==="unknown"`（既知/類似一致は `createFromKnownPattern` 経由で昇格対象外）で、`UnknownAlertClassification.confidence` は**常に null**。よってタスク17 の `classification.confidence` は**昇格パスの Alert には載っていない**。代わりに Alert が実際に持つ graded confidence＝`investigationReport.confidence` を二次信号に使う。これは `InvestigateAlertUseCase` が SimilarIncident 母集団を AI 調査コンテキストへ流し込んだ結果の確度なので「類似の積み上げに裏打ちされた確度」という設計意図と整合する
- 設計判断（重み付けの根拠）: 信頼順は「**人間の承認 > 類似の積み上げ（SimilarIncident 母集団）> AI 自己申告 confidence**」。LLM の生 confidence は較正されておらず過信しがちなので、人間承認を主係数（×0.4）、確度は補助係数（+0.3/+0.1）に抑える
- 設計判断（証拠源数・却下は見送り）: `evidenceWeight(InfraEvidence源数)` は `Alert`/`InvestigationReport` に永続化されておらず（タスク15 の `evidenceSourceCount` 永続化は未実施）、`shouldPromote(alert: Alert)` 契約から取得不能なので**スコープ外**（任意信号なので影響なし）。却下減点も Alert が却下回数を持たず（最新 feedback のみ・しかも昇格パスは isCorrect=true 限定で最新は常に正解）、減点が効かないため見送り＝**Alert/contracts 拡張のスコープクリープを回避**。両者は将来 Alert 拡張時に再検討
- 配線: composition root（step4-3 DI）で `PatternPromotionPolicy` 実装を `FixedThreshold` → `EvidenceWeighted` に差し替えるだけ。`SubmitFeedbackUseCase` はノータッチ（既定は引き続き `FixedThresholdPromotionPolicy`）
- 設計判断（ADR種）: 「昇格を*学習*でなく*結晶化（高速パス焼き付け）*と位置づける理由」「結晶化ゲートを固定回数 → 確度加重へ上げる理由」「主信号を`classification.confidence`でなく`investigationReport.confidence`にした理由（unknown は confidence=null）」を Step5 ADR に残す
- 注意: P0 提出は固定回数のままで成立。**タスク17（連続確度）が入れば本タスクの必要性はさらに下がる**＝後回し可

---

## stretch: ポートフォリオ（フェーズ3）

### タスク 18: ADKマルチエージェント 〔stretch〕✅ 試走実装済み

- 【完了】`infrastructure/adk/`: `ADKAgentInvestigationAdapter.ts`（`AIInvestigationPort`実装）/ `ADKInvestigationAgentRunner.ts`（ADKグラフ構築＋`InMemoryRunner`実行）/ `InvestigationAgentRunner.ts`（IF・text-in/out）/ `agents/InvestigationCoordinator.ts`・`EvidenceCollectorAgent.ts`・`RootCauseAnalystAgent.ts`・`RemediationPlannerAgent.ts` / `tools/investigationTools.ts`（read-only Gateway を ADK FunctionTool 化）
- 【完了】公式 `@google/adk`（TS版・1.3.0）を採用。a2a不使用・in-process。hub-and-spoke: Coordinator(hub) が `AgentTool` 経由で3専門agent(spoke)に委譲し、「分析→（不足なら）証拠追加収集→再分析」を自律反復（＝自律的証拠追加収集ループ）してから最終 JSON を出力
- 【完了】モデル経路は **Vertex AI 共用**（`GOOGLE_GENAI_USE_VERTEXAI` で ADK が自動選択＝Part1 の無料クレジット経路）。`gemini-2.5-pro`。トークン暴走の安全弁＝`maxLlmCalls`（env `AI_INVESTIGATION_ADK_MAX_LLM_CALLS` 既定8）＋ウォールクロック上限
- 【完了】**`AIInvestigationPort` の DI 差し替え1点**で載る（`BackofficeApp`・優先度 stub > ADK > 単一Gemini・`AI_INVESTIGATION_ADK=true`）。`InvestigateAlertUseCase` はノータッチ
- 【完了】**プロンプト構築/出力パース/マッピング/fallback は単一Gemini版と共通化**（`buildUserPrompt`/`parseLLMOutput`/`toInvestigationReport`/`buildFallbackReport`/`buildEvidenceLinks` を再利用＝DRY）。アダプタは `InvestigationAgentRunner` を注入で受け、fake 注入で UT（正常→マッピング／例外→fallback／パース不能→fallback／証拠リンク追記 の4ケース）
- 設計判断（SRP・テスト容易性）: ADK 依存（グラフ構築＋Runner）を `ADKInvestigationAgentRunner` に隔離し、`ADKAgentInvestigationAdapter` は薄いオーケストレーションに保つ（`GeminiLLMClient`↔`LLMInvestigationAdapter` と同型）。ADK 部は疎通主体なので UT せず、分岐はアダプタ側 UT で担保
- 設計判断（証拠の二重収集回避）: `InvestigateAlertUseCase` が広く事前収集する seed 証拠はそのまま seed プロンプトに載せ、エージェントの FunctionTool は「サービス名×時間窓×検索語」で絞った**狙い撃ち追加収集**に限定（依存は全て AIInvestigation 内＝循環依存なし）
- 設計判断（write 隔離不変）: `RemediationPlannerAgent` は修正方針の**起案のみ**。実 PR 起票/apply は既存 `RemediationPort`（人間承認ゲート内）に閉じる
- 設計判断（zod 版整合）: ADK は zod@4 依存。FunctionTool の型を合わせるため root zod を v4 に上げ `zod/v4` から import（root `zod` だと nominal 型が別宣言で代入不可）
- 既知の限界（試走ゆえ）: ライブ疎通（実 Vertex でのループ動作・トークン実測）は未検証＝デプロイ/ADC設定後に確認。E2E は stub 経路のまま無傷
- 参考: 「ADKマルチエージェント実装」節

<!--
【マルチエージェント統合の3パターン整理（A2A 判断のADR種・2026-06-23 確定）】
「マルチエージェント」を1語で混ぜない。性質の違う3つに分ける:
  ① ADK in-process（本タスク・調査/推論）: EvidenceCollector/RootCauseAnalyst/Planner が
     共有コンテキスト（alert/evidence/仮説）を見ながら密に反復。通信=関数呼び出し。→ in-process が正解。
  ② dispatch + callback（step4-3 タスク11/16・実行/修正・実装済）: GitHub Actions の Gemini CLI 等が
     test ハーネスのあるランナーで実コード修正。通信=repository_dispatch↓ / ingest callback↑。
     一発のタスク委譲であって「会話」ではない。
  ③ A2A facade（タスク30・外部相互運用・stretch候補）: 自分の調査agentを Agent Card で公開し
     Gemini Enterprise / Elastic から呼ばせる。ベンダー跨ぎの相互運用。

【A2A 判断 = コア不採用＋③ stretch facade 候補】
- ①も②も「会話」でなく「タスク委譲/関数呼び出し」なので A2A（会話プロトコル）は不要。
  両端を自分が握るため自前RPC（①関数・②dispatch）の方が軽く確実で、A2A にしても修正の正しさは
  test gate が担保する点は変わらない。→ 既存ADR「a2a不使用」を「①②とも会話でなくタスク委譲だから」で補強。
- トポロジは hub-and-spoke（mesh ではない）: hub=backend orchestrator（調査 in-process＋どこを直すか判断）、
  spoke=各環境の使い捨て実行agent（GitHub Actions / 将来 terraform）。spoke 同士は会話せず各自 hub に結果を返す。
  情報受け渡し=単一の真実（hub の Alert/InvestigationReport）→ spoke に自己完結ペイロード↓ / 自己完結結果↑。
  spoke は相互参照・共有可変状態を持たない（既存の冪等・dedup 設計思想と一致）。
- A2A は③として hub の前段に足す facade（②dispatch を置き換えない・既存無傷）。やるなら Elastic スポンサー絡みの見せ場。
-->

### タスク 30: A2A 外部 facade（提案・未実装・stretch/ポートフォリオ）

> **状態: 設計のみ・未実装。コア設計には不採用**（上記3パターン整理の③）。やるかは独立判断（Elastic 連携の見せ場として価値が出るなら）。
> 既存の①ADK in-process / ②dispatch+callback は**ノータッチ**。hub の前段に「外部から呼べる入口」を1枚足すだけ。

<!--
【狙い】自分の調査エージェント（`AIInvestigationPort` 相当の能力）を A2A Agent Card で公開し、
Gemini Enterprise / Elastic Agent などベンダー跨ぎのオーケストレータから capability として呼べるようにする。
今夜の Elastic Bootcamp（Elastic Agent→Gemini Enterprise を A2A 連携）の構成を、向きを変えて
「自分が callee 側（Agent Card を出す側）」で実装する形。Elastic は SimilarIncident で既に利用中なので接続文脈が近い。

【設計の継ぎ目】
- 既存 `AIInvestigationPort`（または read-only Query 群）を A2A の「スキル」として薄くラップする adapter を新設。
  ドメイン/UseCase はノータッチ＝外部プロトコル適合層（ACL）を1枚足すだけ（②dispatch と同じ思想）。
- 公開物: Agent Card（JSON・能力記述）＋ A2A Protocol Endpoint（task送受信）。A2A Inspector で疎通確認。
- 認証/認可・レート制御は facade 層で。read-only 能力のみ公開し、write（PR起票/apply）は公開しない
  （write は人間承認ゲートの内側に閉じる原則を越境させない）。

【コスト/前提】
- Agent Card ホスティング・protocol endpoint・認証・A2A クライアント側検証の実装コストが乗る。
  本体の正しさには寄与しない（相互運用性の獲得が目的）。よってコア外・stretch 据え置き。
- 採用判断は Bootcamp 受講後でよい。不採用でもコア（①②）は完結している。
-->

- 【新規(将来)】`infrastructure/a2a/`: `A2AInvestigationFacade`（`AIInvestigationPort`/read-only Query をスキルとして公開）＋ Agent Card ＋ Protocol Endpoint
- read-only 能力のみ公開（write=PR起票/apply は非公開＝人間承認ゲートの内側に閉じる）。A2A Inspector で疎通確認
- コア（①ADK in-process / ②dispatch+callback）はノータッチ。採用可否は Elastic 連携の見せ場価値で独立判断

---

## stretchⅠ: 検知ソース流入経路（push）と Cloud Monitoring 連携の仕上げ

> **状況（2026-06 確認）**: 流入の**具象クラスは実装済み**——`CloudMonitoringAlertIngestController` + `CloudMonitoringAlertTranslator`（`POST /ingest/cloud-monitoring`）/ `SecurityScanIngestPostController` / EC 自前イベントは `CollectMonitoringEventOnECEventPublished`（RabbitMQ subscriber）。シナリオ4の証拠 Gateway（`CloudLoggingGateway` / `TerraformGateway` / `GitHubGateway` + `InfraInvestigationPort`）も実装済み。**新規 ingest クラスは不要**。本節は GCP 実機連携の仕上げ（`step4-1` §11.2）。
> 経路の原則は `CollectMonitoringEventSubscriber` のクラスコメント（EC=バス購読 / 外部 push=HTTP ingest の peer アダプタ）どおり。

### タスク 31: Cloud Monitoring webhook → INFRASTRUCTURE/CAPACITY 正規化の検証・拡張 〔stretchⅠ〕→ **step4-5 T7 へ移動**

> translator 本体・UT は実装済み。残る「実機 payload での検証・fixture 追加」はデプロイ後作業のため `docs/step4-5-backoffice-infra.todo.md` タスク T7 に移動・集約した。内容はそちらを正とする。

### タスク 32: CloudMonitoringGateway（pull・メトリクス相関）〔stretchⅠ / 次フェーズ〕→ **step4-5 T13 へ移動**

> デプロイ着地後の任意タスクのため `docs/step4-5-backoffice-infra.todo.md` タスク T13 に移動・集約した。内容はそちらを正とする。

---

## stretchⅡ: 予兆ブリーフィング（reactive → proactive）

> **着手条件**: P0 ＋ P1 ＋ 既存stretch（タスク18）が**全部着地後**の capstone。設計は `step4-1` 7章＋`step4-2`「予兆ブリーフィング」節。突合キーは **(B) 構造化タグ**採用。**既存P0パイプラインは無傷**で横に生やす。

### タスク 19: Forecast ドメイン型 〔stretchⅡ〕

- 【新規】`Forecast/domain/ForecastSignal.ts`（id/kind/subject/when/desc/source・kind=FUTURE_CHANGE|SCHEDULE|MEMORY）
- 【新規】`RiskForecast.ts`（forecastId/generatedAt/horizon/risks[]/isFallback、`RiskItem`=window/subject/level/confidence/**citations**/reasoning）
- 【新規】`Schedule.ts`（`ScheduleWindow`）/ `ScheduleSource.ts`（interface・read-only）
- 【新規】`Forecast/domain/ForecastSignalSource.ts`（IF・`collect(horizon): Promise<ForecastSignal[]>`）★Ⅱ→Ⅲ の継ぎ目（`step4-1` §7.9）。主シグナル源を源非依存に抽象化し、Handler に Gateway を名指しさせない

> **相関（タスク9e）との共通化メモ（2026-06 調査）**: `RiskItem.citations`（引用＝根拠 id）と、step4-4 タスク9e で実装済みの AI 相関（`InvestigationReportPrimitives.relatedAlerts`：id・relation・rationale）は**同型のパターン**＝「LLM が _id + ラベル + 根拠_ を副産物として出し、防御的に正規化してから実在レコードへ照合（引用検証 §7.3 ＝ 相関 id 解決）」。引用 incidentId は `SimilarIncident.sourceAlertId`＝実在 Alert id（タスク12）なので、相関 alertId と同じく実在 Alert に解決できる。
> **ただし context を跨いだ型共有はしない**: 相関は Monitoring BC、引用は Forecast BC の別物。`RelatedAlertPrimitives` を Forecast から import すると BC 結合になるので避け、各 BC が自前の型を持つ。共通なのは*手順*（LLM 出力の防御的正規化＋citations 必須プロンプト＋実在照合）だけ。`GeminiForecastAdapter`（タスク22）の safeParse/clamp/fallback は `LLMOutputParser`/`InvestigationReportMapper`（タスク9e で relatedAlerts 対応済み）の実装を**参考にする**（コピー元）。frontend 側の共通化（`RelatedAlertsPanel`→`CitationList` の `shared/ui` 昇格）は step4-4 タスク13 のメモを正とする。

### タスク 20: ForecastMemory projection（突合キーB）〔stretchⅡ〕

- 【新規】`Forecast/domain/ForecastMemory.ts`（`ForecastMemoryEntry`=incidentId/subject/trigger/outcome、`ForecastMemoryRepository`：warmUp/findBySubjects）
- 【新規】`infrastructure/` 実装（Resolved から subject 投影）。`ForecastMemoryEntry.incidentId` は `SimilarIncident.sourceAlertId`（step4-2 タスク 12 で追加した back-link）を投影元にすれば、citation を**実在する Alert id**に解決でき引用検証（§7.3）が効く
- 【補足】`trigger`/`outcome` 文も `resolvedNote`（index 時に AI調査 summary をフォールバック充填）から導出できる。汎用文字列ではなく「どう直したか」が入るようになったため、突合の母集団が痩せない
- 【修正】`InvestigationReport` に optional `subject?: string` 追記（後方互換）＋ `InvestigateAlertUseCase` で導出して埋める ← **唯一の既存P0変更点**

### タスク 21: Gateway 未来シグナル取得メソッド ＋ ForecastSignalSource 実装 〔stretchⅡ〕

- 【修正】`GitHubGateway` に `listOpenPullRequests()`（未マージ）/ `TerraformGateway` に `getPendingPlan()`（未適用）を追加（**read-only維持**）
- 各 `*Impl.ts` に実装追加
- 【新規】`ForecastSignalSource` の3実装（各 Gateway/Source を内包し `ForecastSignal` に正規化して返す）:
  - `PullRequestSignalSource`（GitHub `listOpenPullRequests` → FUTURE_CHANGE）
  - `PendingPlanSignalSource`（Terraform `getPendingPlan` → FUTURE_CHANGE）
  - `ScheduleSignalSource`（`ScheduleSource.list` → SCHEDULE）
- 設計判断: 正規化（subject/when/desc 付与）を各 Source 内に閉じることで、Handler は `ForecastSignalSource[]` を回すだけになり stretchⅢ の源追加が容易になる

### タスク 22: ForecastPort ＋ Gemini アダプタ 〔stretchⅡ〕

- 【新規】`Forecast/domain/ForecastPort.ts` / `ForecastContext.ts`
- 【新規】`infrastructure/GeminiForecastAdapter.ts`（既存Geminiアダプタ踏襲・JSON固定・**citations必須をプロンプト強制**・safeParse・confidenceクランプ・fallback）

### タスク 23: ForecastRiskCommandHandler 〔stretchⅡ〕

- 【新規】`Forecast/application/ForecastRisk/ForecastRiskCommand.ts` / `ForecastRiskCommandHandler.ts`
- フロー: `signalSources: ForecastSignalSource[]` を回して主シグナル収集（PR/plan/schedule）→ subject抽出→ ForecastMemory.findBySubjects（MEMORY）→ 全シグナル結合 → Context → Port.forecast → **引用検証（citations実在照合・偽引用は落とす）** → 保存（最小はメモリ最新）
- 依存は `ForecastSignalSource[]` / ForecastMemoryRepository / ForecastPort / Logger（全て read-only・write無し）。**Gateway は名指ししない**（Source 経由）
- 設計判断（継ぎ目）: 源を配列で受けることで、stretchⅢ は `EventLogPrecursorSource` を配列に足すだけ＝Handler ノータッチ（`step4-1` §7.9）。記憶（MEMORY）は subject 駆動なので配列反復と別ステップ
- 参考: 「ForecastRiskCommandHandler」節

> ✅ **デモシナリオ6（録画）: seed → `POST /forecast` → 引用付きリスク予報。** API は step4-3 の予兆タスク、UI は step4-4 の予兆タスクと結線。

---

## stretchⅢ: ログベース・イベントソーシング基盤＋予知ビュー（設計のみ・実装はハッカソン後）

> **着手条件**: stretchⅡ 着地後。**前倒し実装はしない**（薄い／障害寄りの現行 DomainEvent では予兆の母集団が不足しデモ価値が出ない）。設計は `step4-1` §7.10 ＋ `step4-2`「stretchⅢ」節。**既存パイプライン・stretchⅡ の突合機構は無傷**で、追記 sink と Source を1個ずつ足すだけ。

### タスク 26: EC ドメインイベント拡張（前提作業）〔stretchⅢ〕

- 【新規/修正】EC コンテキストに正常系の業務 DomainEvent を増やす（予兆の母集団を太らせる＝moat の前提。`step4-1` §7.10 留意点）
- 現状4イベント（order.placed / inventory.reserved / payment.timeout / inventory.reservation_failed）・半分が障害寄り。範囲は Step5 で判断

### タスク 27: EventLog 追記 sink 〔stretchⅢ〕

- 【新規】`EventLog/domain/EventLogEntry.ts`（type）/ `EventLogRepository.ts`（IF・`append`/`findRecent`・追記専用）
- 【新規】`EventLog/infrastructure/MongoEventLogRepository.ts`（append-only コレクション）
- 【新規】`EventLog/application/AppendEventLogOnDomainEvent.ts`（**全 DomainEvent** を購読 → `append()`。障害系3キューに絞る `CollectMonitoringEventOnECEventPublished` と違い正常系も貯める）

### タスク 28: ForecastMemory 上流差し替え 〔stretchⅢ〕

- 【修正】`ForecastMemoryRepository.warmUp()` の投影元を Mongo(Resolved) → `EventLogRepository` に差し替え。**consumer（`findBySubjects`）はノータッチ**（projection は再構築可能であるべき原則）

### タスク 29: EventLogPrecursorSource（予知ビュー合流）〔stretchⅢ〕

- 【修正】`Forecast/domain/ForecastSignalKind` に `PRECURSOR` を追加（後方互換の追記）
- 【新規】`EventLogPrecursorSource implements ForecastSignalSource`（`EventLogRepository.findRecent` → 直近イベント列を `ForecastSignal`(PRECURSOR) に正規化）
- 【配線】composition root（step4-3）で `signalSources` 配列に push するだけ。Handler / ForecastPort / 引用検証 / read-model / UI ノータッチ
- 設計判断: 統計MLでなく LLM に event-log 文脈を渡す＝相関の検出。因果推論は研究フロンティアとして ADR（`step4-1` §7.10 ADR種）
