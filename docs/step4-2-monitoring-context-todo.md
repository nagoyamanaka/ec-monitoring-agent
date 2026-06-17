# Step 4-2 TODO: Monitoring コンテキスト実装

> 対応設計: `docs/step4-2-monitoring-context.md`
> このスコープが最重要・最大。**依存順**に並べ、優先度: **P0必須**（提出ライン） / **P1差別化** / **stretch**。
> 各タスク完了ごとにコミット。P0が全部通れば「提出可能」状態。
>
> **実装プロンプト雛形**（各タスクで使う）:
> 「`/home/shigeyasu/Project/ec-monitoring-agent` の TypeScript DDD プロジェクトで、下記ファイルを新規作成。CodelyTV パターン準拠（AggregateRoot/DomainEvent/VO/CommandHandler）。参考: `docs/step4-2-monitoring-context.md` の該当節。テストは隣にコロケーション（`*.test.ts`）。」
>
> **テスト方針**:
> - `type` / `as const` 定義のみのファイル（MonitoringEvent, AlertSeverity, AlertStatus 等）はテスト不要
> - ドメイン制約（範囲検証・不変条件）や振る舞い（状態遷移・集計ロジック）があるものだけテストを書く
> - 例: `ClassificationConfidence.of()` の範囲制約、`Alert` の状態遷移メソッドは対象

---

## P0: 提出ライン（フェーズ0）

### タスク 1: MonitoringEvent ＋ category 〔P0〕
- 【新規】`src/Contexts/Monitoring/Shared/domain/MonitoringEvent.ts`
- `category: MonitoringEventCategory`（APPLICATION/INFRASTRUCTURE/CAPACITY/SECURITY）＋ `source: string`
- ECの型を直接importしない。`payload: Record<string, unknown>`
- 参考: 「MonitoringEvent」「category の役割」節

### タスク 2: Alert 集約 ＋ VO 〔P0〕
- 【新規】`Alert.ts` / `AlertId.ts`(Uuid) / `AlertSeverity.ts`(CRITICAL/WARNING/INFO) / `AlertStatus.ts`(OPEN/ANALYZING/RESOLVED)
- ファクトリ: `createFromKnownPattern` / `createAsUnknown`、メソッド: `attachInvestigationReport`（reviewStatus=PENDING_REVIEW初期化）/ `submitFeedback`（isCorrect→reviewStatus APPROVED/REJECTED, correctFeedbackCount++）/ `toPrimitives`/`fromPrimitives`
- 参考: 「Alert集約」節

### タスク 3: AlertClassification VO 〔P0〕
- 【新規】`AlertClassification.ts`: `ClassificationConfidence`（クラス・0〜1制約・`certain()`/`isHighConfidence()`）、`MatchedCondition`/`UnmatchedCondition`（interface）、`Known`/`Unknown` union
- 重みはVOに持たせない（Classifier内部）。参考: 「AlertClassification」節

### タスク 4: KnownErrorPattern ＋ シード 〔P0〕
- 【新規】`KnownErrorPattern.ts` / `PayloadCondition`
- シード4件（PAYMENT_TIMEOUT / INVENTORY_INSUFFICIENT / INVENTORY_CONCURRENT_CONFLICT）。`PAYMENT_TIMEOUT_NO_ORDER` は作らない（到達不能）
- 参考: 「KnownErrorPattern」「シードデータ」節

### タスク 5: AlertClassifier interface ＋ InMemory 実装 〔P0〕
- 【新規】`domain/AlertClassifier.ts`（`classify(event, patterns): AlertClassificationResult`）
- 【新規】`infrastructure/InMemoryAlertClassifier.ts`（first-match・confidence 1.0・unmatched空）
- 参考: 「AlertClassifier インターフェース」「InMemoryAlertClassifier」節

### タスク 6: Repository interface ＋ Mongo 実装 〔P0〕
- 【新規】`domain/AlertRepository.ts` / `domain/KnownErrorPatternRepository.ts`
- 【新規】`infrastructure/persistence/MongoAlertRepository.ts` / `MongoKnownErrorPatternRepository.ts`（`MongoRepository` 継承）
- `findAll()` は createdAt ASC（マッチ優先度）。参考: 各Repository節

### タスク 7: AnalyzeAlertCommandHandler 〔P0〕
- 【新規】`application/AnalyzeAlert/AnalyzeAlertCommand.ts` / `AnalyzeAlertCommandHandler.ts`
- 既知→`createFromKnownPattern`→save→SSE notify / 未知→`createAsUnknown`→save→SSE notify（分析中）→ `InvestigateAlertCommand` 発行
- 依存: AlertRepository / KnownErrorPatternRepository / AlertClassifier / EventBus / SSEAlertNotifier / Logger
- 参考: 「AnalyzeAlertCommandHandler」節（重複3a行は無し）

### タスク 8: CollectMonitoringEventOnECDomainEvent 〔P0〕
- 【新規】`infrastructure/subscribers/CollectMonitoringEventOnECDomainEvent.ts`
- eventNameで分岐デシリアライズ → MonitoringEvent変換（category=APPLICATION）→ AnalyzeAlertCommand
- 変換規則: OrderPlaced=subtotalAmount / ReservationFailed=+reservedProductIds / PaymentTimeout=aggregateId=paymentAttemptId,payload{orderId,customerId,amount}
- 参考: 「変換規則表」「CollectMonitoringEvent」節

### タスク 9: InvestigationReport ＋ ReviewStatus 〔P0〕
- 【新規】`AIInvestigation/domain/InvestigationReport.ts`（summary/confidence/severity/investigationSteps/suggestedActions/suggestedPatternName/reviewStatus/investigatedAt/isFallback）
- 【新規】`AIInvestigation/domain/ReviewStatus.ts`（PENDING_REVIEW/APPROVED/REJECTED）

### タスク 10: AIInvestigationPort ＋ Gemini Adapter 〔P0〕
- 【新規】`domain/AIInvestigationPort.ts` / `domain/InvestigationContext.ts`
- 【新規】`infrastructure/GeminiAIInvestigationAdapter.ts`（`@google/generative-ai`・JSON固定出力・safeParse・confidenceクランプ・タイムアウト1回リトライ・fallback）
- 参考: 「AIInvestigationPort」「GeminiAIInvestigationAdapter」節

### タスク 11: InvestigateAlertCommandHandler 〔P0〕
- 【新規】`application/InvestigateAlert/InvestigateAlertCommand.ts` / `InvestigateAlertCommandHandler.ts`
- findById→（InfraInvestigation.collect: P1で結線、P0はskip）→SimilarIncident.findSimilar→Context構築→Port.investigate→attachReport→save→SSE notify
- 依存: AlertRepository / SimilarIncidentRepository / (InfraInvestigationPort) / AIInvestigationPort / SSEAlertNotifier / Logger

### タスク 12: SimilarIncident（InMemory）〔P0〕
- 【新規】`SimilarIncident/domain/SimilarIncident.ts` / `SimilarIncidentRepository.ts`
- 【新規】`infrastructure/InMemorySimilarIncidentRepository.ts`（warmUp/findSimilar/index・上限100）/ `InMemoryCriteriaConverter.ts`
- Shared/domain/criteria を流用。参考: 「SimilarIncidentRepository」節

### タスク 13: SSEAlertNotifier interface ＋ EventEmitter 実装 〔P0〕
- 【新規】`ReportGeneration/infrastructure/SSEAlertNotifier.ts`（interface）/ `EventEmitterSSEAlertNotifier`
- HTTP接続管理（addConnection/removeConnection/notify）。Express側の機構は step4-3

### タスク 14: SubmitFeedback ＋ 自動昇格 / 手動昇格 〔P0〕
- 【新規】`AlertAnalysis/application/SubmitFeedback/SubmitFeedbackCommand.ts` / `SubmitFeedbackCommandHandler.ts`
- isCorrect→SimilarIncident.index、correctFeedbackCount>=AUTO_PROMOTE_THRESHOLD→KnownErrorPattern自動昇格
- 【新規】`PromotePatternCommandHandler`（手動 `POST /patterns/:id/promote`）
- 参考: 「フィードバックループの集約設計」節

> ✅ **ここまででデモシナリオ1・2・3がE2Eで通る。コミットを切り提出可能状態をキープ。**

---

## P1: 差別化（フェーズ1・1.5）

### タスク 15: InfraInvestigation（証拠収集）〔P1〕
- 【新規】`AIInvestigation/InfraInvestigation/domain/`: `InfraInvestigationPort.ts` / `InfraEvidence.ts` / `CloudLoggingGateway.ts` / `TerraformGateway.ts` / `GitHubGateway.ts`（**全て読み取り専用**）
- 【新規】`infrastructure/`: `DefaultInfraInvestigationAdapter.ts`（category別に証拠源出し分け）/ 各 `*Impl.ts`
- タスク11の `InvestigateAlertCommandHandler` に `collect()` を結線、`InvestigationContext.infraEvidence` に統合
- 参考: 「インフラ横断調査パイプライン」節 → デモシナリオ4

### タスク 16: Remediation（PR起票・write隔離）〔P1〕
- 【新規】`AIInvestigation/Remediation/domain/RemediationPort.ts` / `RemediationPlan.ts`
- 【新規】`infrastructure/GitHubPullRequestGateway.ts`（GITHUB_TOKEN・対象repo限定・自動マージしない）
- SECURITYカテゴリの RemediationPlanner から呼ぶ。参考: 「セキュリティ＋自律リメディエーション」節

### タスク 17: ElasticAlertClassifier 〔P1/stretch〕
- 【新規】`infrastructure/ElasticAlertClassifier.ts`（hybrid search・スコア正規化→confidence）
- `Shared/infrastructure/persistence/elasticsearch/` を利用。InfraEvidenceでクエリ強化
- DI差し替えのみ。AnalyzeAlertCommandHandler ノータッチ

---

## stretch: ポートフォリオ（フェーズ3）

### タスク 18: ADKマルチエージェント 〔stretch〕
- 【新規】`infrastructure/adk/`: `ADKAgentInvestigationAdapter.ts` / `InvestigationCoordinator.ts` / `EvidenceCollectorAgent.ts` / `RootCauseAnalystAgent.ts` / `RemediationPlannerAgent.ts`
- a2a不使用・in-process。自律的証拠追加収集ループを実装
- `AIInvestigationPort` のDI差し替えのみ。参考: 「ADKマルチエージェント実装」節
