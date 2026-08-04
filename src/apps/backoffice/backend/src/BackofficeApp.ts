import { AnalyzeAlertCommandHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/AnalyzeAlert/AnalyzeAlertCommandHandler.js";
import { AnalyzeAlertUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/AnalyzeAlert/AnalyzeAlertUseCase.js";
import { CollectMonitoringEventUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { GetAlertQueryHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetAlert/GetAlertQueryHandler.js";
import { GetAlertUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetAlert/GetAlertUseCase.js";
import { GetAlertReportQueryHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetAlertReport/GetAlertReportQueryHandler.js";
import { GetAlertReportUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetAlertReport/GetAlertReportUseCase.js";
import { GetAnalyticsQueryHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/GetAnalyticsQueryHandler.js";
import { GetAnalyticsUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetAnalytics/GetAnalyticsUseCase.js";
import { GetKnownErrorPatternsQueryHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/GetKnownErrorPatternsQueryHandler.js";
import { GetKnownErrorPatternsUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/GetKnownErrorPatternsUseCase.js";
import { PromotePatternCommandHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/PromotePattern/PromotePatternCommandHandler.js";
import { PromotePatternUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/PromotePattern/PromotePatternUseCase.js";
import { PromoteAlertCommandHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/PromoteAlert/PromoteAlertCommandHandler.js";
import { PromoteAlertUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/PromoteAlert/PromoteAlertUseCase.js";
import { SubmitFeedbackCommandHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/SubmitFeedback/SubmitFeedbackCommandHandler.js";
import { SubmitFeedbackUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/SubmitFeedback/SubmitFeedbackUseCase.js";
import { buildAlertClassifier } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/buildAlertClassifier.js";
import { KnownPatternRule } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/rules/KnownPatternRule.js";
import { SimilarPatternRule } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/rules/SimilarPatternRule.js";
import { ClassificationRule } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/ClassificationRule.js";
import { MongoAlertRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { ReadModelCachingAlertRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/ReadModelCachingAlertRepository.js";
import { RedisAlertReadModelStore } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/readmodel/RedisAlertReadModelStore.js";
import { AlertReadModelStore } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/readmodel/AlertReadModelStore.js";
import { AlertRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/AlertRepository.js";
import { MongoKnownErrorPatternRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoKnownErrorPatternRepository.js";
import { InvestigateAlertUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/InvestigateAlert/InvestigateAlertUseCase.js";
import { ReinvestigateAlertUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/ReinvestigateAlert/ReinvestigateAlertUseCase.js";
import { ReinvestigateAlertCommandHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/ReinvestigateAlert/ReinvestigateAlertCommandHandler.js";
import { RequestAlertInvestigationUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/RequestInvestigation/RequestAlertInvestigationUseCase.js";
import { RequestAlertInvestigationCommandHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/RequestInvestigation/RequestAlertInvestigationCommandHandler.js";
import { GetInfraEvidenceUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/GetInfraEvidenceUseCase.js";
import { GetInfraEvidenceQueryHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/GetInfraEvidenceQueryHandler.js";
import { DraftRemediationUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/DraftRemediation/DraftRemediationUseCase.js";
import { DraftRemediationCommandHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/DraftRemediation/DraftRemediationCommandHandler.js";
import { GetRemediationUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetRemediation/GetRemediationUseCase.js";
import { GetRemediationQueryHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetRemediation/GetRemediationQueryHandler.js";
import { RecordRemediationResultUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/RecordRemediationResult/RecordRemediationResultUseCase.js";
import { ExpireStaleRemediationsUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/ExpireStaleRemediations/ExpireStaleRemediationsUseCase.js";
import { RemediationExecutor } from "../../../../Contexts/Monitoring/AIInvestigation/domain/remediation/RemediationExecutor.js";
import { RemediationPort } from "../../../../Contexts/Monitoring/AIInvestigation/domain/remediation/RemediationPort.js";
import { InfraInvestigationPort } from "../../../../Contexts/Monitoring/AIInvestigation/domain/InfraInvestigationPort.js";
import { LLMRemediationPlanner } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/LLMRemediationPlanner.js";
import { GitHubPullRequestGateway } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/GitHubPullRequestGateway.js";
import { InProcessAdvisoryRemediation } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/InProcessAdvisoryRemediation.js";
import { GitHubActionsRemediationDispatcher } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/GitHubActionsRemediationDispatcher.js";
import { FixedLinkDemoRemediation } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/FixedLinkDemoRemediation.js";
import { MongoRemediationRepository } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/MongoRemediationRepository.js";
import { LLMInvestigationAdapter } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/LLMInvestigationAdapter.js";
import { GeminiLLMClient } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/GeminiLLMClient.js";
import { StubLLMClient } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/StubLLMClient.js";
import { LLMTextClient } from "../../../../Contexts/Monitoring/AIInvestigation/domain/LLMTextClient.js";
import { AIInvestigationPort } from "../../../../Contexts/Monitoring/AIInvestigation/domain/AIInvestigationPort.js";
import { ADKAgentInvestigationAdapter } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/adk/ADKAgentInvestigationAdapter.js";
import { ADKInvestigationAgentRunner } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/adk/ADKInvestigationAgentRunner.js";
import { GeminiInvestigationFinalizer } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/adk/GeminiInvestigationFinalizer.js";
import { InMemoryEscalationDirectory } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/escalation/InMemoryEscalationDirectory.js";
import { ESCALATION_DIRECTORY_SEED } from "../../../../Contexts/Monitoring/seeds/EscalationDirectorySeed.js";
import { DefaultInfraInvestigationAdapter } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/DefaultInfraInvestigationAdapter.js";
import { CloudLoggingGatewayImpl } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/CloudLoggingGatewayImpl.js";
import { CloudMonitoringGatewayImpl } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/CloudMonitoringGatewayImpl.js";
import { TerraformGatewayImpl } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/TerraformGatewayImpl.js";
import { MongoAppliedInfraChangeStore } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/MongoAppliedInfraChangeStore.js";
import { GitHubGatewayImpl } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/GitHubGatewayImpl.js";
import { GitHubPullRequestReadGateway } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/GitHubPullRequestReadGateway.js";
import { InMemoryPendingInfraPlanStore } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/InMemoryPendingInfraPlanStore.js";
import { ForecastRiskCommandHandler } from "../../../../Contexts/Monitoring/Forecast/application/ForecastRisk/ForecastRiskCommandHandler.js";
import { ForecastRiskUseCase } from "../../../../Contexts/Monitoring/Forecast/application/ForecastRisk/ForecastRiskUseCase.js";
import { ForecastPort } from "../../../../Contexts/Monitoring/Forecast/domain/ForecastPort.js";
import { ForecastSignalSource } from "../../../../Contexts/Monitoring/Forecast/domain/ForecastSignalSource.js";
import { GeminiForecastAdapter } from "../../../../Contexts/Monitoring/Forecast/infrastructure/GeminiForecastAdapter.js";
import { MongoRiskForecastRepository } from "../../../../Contexts/Monitoring/Forecast/infrastructure/MongoRiskForecastRepository.js";
import { PendingPlanSignalSource } from "../../../../Contexts/Monitoring/Forecast/infrastructure/PendingPlanSignalSource.js";
import { PullRequestSignalSource } from "../../../../Contexts/Monitoring/Forecast/infrastructure/PullRequestSignalSource.js";
import { ResolvedAlertForecastMemoryRepository } from "../../../../Contexts/Monitoring/Forecast/infrastructure/ResolvedAlertForecastMemoryRepository.js";
import { ScheduleSignalSource } from "../../../../Contexts/Monitoring/Forecast/infrastructure/ScheduleSignalSource.js";
import { SeedScheduleSource } from "../../../../Contexts/Monitoring/Forecast/infrastructure/SeedScheduleSource.js";
import { FORECAST_SCHEDULE_SEED } from "../../../../Contexts/Monitoring/seeds/ForecastScheduleSeed.js";
import {
  FORECAST_FLAGSHIP_PLAN_ADDRESS,
  FORECAST_PENDING_PLAN_SEED,
  withPendingPlanEvidenceUrls,
} from "../../../../Contexts/Monitoring/seeds/ForecastPendingPlanSeed.js";
import { EventEmitterSSEAlertNotifier } from "../../../../Contexts/Monitoring/AlertNotification/infrastructure/EventEmitterSSEAlertNotifier.js";
import { RedisSSEAlertNotifier } from "../../../../Contexts/Monitoring/AlertNotification/infrastructure/RedisSSEAlertNotifier.js";
import { SSEAlertNotifier } from "../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";
import { createValkeyConnection } from "../../../../Contexts/Shared/infrastructure/valkey/ValkeyConnectionFactory.js";
import { ValkeyConnection } from "../../../../Contexts/Shared/infrastructure/valkey/ValkeyConnection.js";
import { InMemorySimilarIncidentRepository } from "../../../../Contexts/Monitoring/SimilarIncident/infrastructure/InMemorySimilarIncidentRepository.js";
import {
  ElasticSimilarIncidentRepository,
  SIMILAR_INCIDENTS_INDEX_CONFIG,
} from "../../../../Contexts/Monitoring/SimilarIncident/infrastructure/ElasticSimilarIncidentRepository.js";
import { SimilarIncidentRepository } from "../../../../Contexts/Monitoring/SimilarIncident/domain/SimilarIncidentRepository.js";
import { ElasticClientFactory } from "../../../../Contexts/Shared/infrastructure/persistence/elasticsearch/ElasticClientFactory.js";
import { CommandHandlers } from "../../../../Contexts/Shared/infrastructure/CommandBus/CommandHandlers.js";
import { InMemoryCommandBus } from "../../../../Contexts/Shared/infrastructure/CommandBus/InMemoryCommandBus.js";
import { DomainEventFailoverPublisher } from "../../../../Contexts/Shared/infrastructure/EventBus/DomainEventFailoverPublisher/DomainEventFailoverPublisher.js";
import { DomainEventSubscribers } from "../../../../Contexts/Shared/infrastructure/EventBus/DomainEventSubscribers.js";
import { RabbitMQConfigurer } from "../../../../Contexts/Shared/infrastructure/EventBus/RabbitMq/RabbitMQConfigurer.js";
import { RabbitMQQueueNameFormatter } from "../../../../Contexts/Shared/infrastructure/EventBus/RabbitMq/RabbitMQQueueNameFormatter.js";
import { RabbitMqConnection } from "../../../../Contexts/Shared/infrastructure/EventBus/RabbitMq/RabbitMqConnection.js";
import { RabbitMQEventBus } from "../../../../Contexts/Shared/infrastructure/EventBus/RabbitMq/RabbitMqEventBus.js";
import { GcpCloudLoggingLogger } from "../../../../Contexts/Shared/infrastructure/logging/GcpCloudLoggingLogger.js";
import { MongoClientFactory } from "../../../../Contexts/Shared/infrastructure/persistence/mongo/MongoClientFactory.js";
import { InMemoryQueryBus } from "../../../../Contexts/Shared/infrastructure/QueryBus/InMemoryQueryBus.js";
import { QueryHandlers } from "../../../../Contexts/Shared/infrastructure/QueryBus/QueryHandlers.js";
import type { Application } from "express";
import { Server } from "./server.js";
import { registerRoutes } from "./routes/index.js";
import { buildBackofficeSubscribers } from "./subscribers/BackofficeSubscribers.js";
import { HttpEcDemoGateway } from "./demo/HttpEcDemoGateway.js";
import { EcDemoGateway } from "./demo/EcDemoGateway.js";
import { TriggerDemoScenarioUseCase } from "./demo/TriggerDemoScenarioUseCase.js";
import { MongoDemoDataAdapter } from "./demo/MongoDemoDataAdapter.js";
import { DemoResetUseCase } from "./demo/DemoResetUseCase.js";
import { config } from "./config.js";

// 結合テスト用の差し替え seam。本番は何も渡さず（既定の実装を使う）、
// 結合テストだけ「実際に外部を叩く driven アダプタ」を vi.fn 等で置き換える。
export type BackofficeAppOverrides = {
  // PR起票（GitHub への write）の唯一の出口。未指定なら GitHubPullRequestGateway。
  // advisory 経路のみ有効（dispatch 経路は GitHubActionsRemediationDispatcher が担う）。
  remediationPort?: RemediationPort;
  // インフラ証拠の収集口（Cloud Logging/Terraform/GitHub を読む）。未指定なら実 Gateway 群。
  // evidence ルートと、未知分類後の非同期調査が叩くため、結合テストでは stub に差し替える。
  infraInvestigationPort?: InfraInvestigationPort;
  // demo パネルが EC backend を叩く口。未指定なら HttpEcDemoGateway（実 EC へ HTTP）。
  ecDemoGateway?: EcDemoGateway;
  // 予報生成の口（Gemini）。未指定なら GeminiForecastAdapter。結合テストでは決定的な fake に差し替える。
  forecastPort?: ForecastPort;
};

// dispatched の期限切れを探しに行く間隔。期限そのもの（REMEDIATION_DISPATCH_TIMEOUT_MS）と違い、
// 運用で変える必要が無いので env にしない。1分＝画面の待ち体験に対して十分細かい。
const REMEDIATION_EXPIRY_SWEEP_INTERVAL_MS = 60000;

export class BackofficeApp {
  private server!: Server;
  private connection!: RabbitMqConnection;
  private valkey?: ValkeyConnection;
  private remediationExpirySweep?: NodeJS.Timeout;

  constructor(private readonly overrides: BackofficeAppOverrides = {}) {}

  // 配線をすべて行うが listen はしない。結合テストは build() 後に httpApp を supertest へ渡す。
  async build(): Promise<void> {
    const mongoClient = await MongoClientFactory.createClient("backoffice", { url: config.mongoUrl });
    const logger = new GcpCloudLoggingLogger();

    // Valkey 接続（stretchⅠ）。REDIS_URL 無効時は null object（read-model 無効・SSE は in-process）。
    // SSE Pub/Sub（task17）と read-model projection（task18）で共有する。
    const valkey = createValkeyConnection({ url: config.valkey.url });
    this.valkey = valkey;

    this.connection = new RabbitMqConnection({
      connectionSettings: {
        username: config.rabbitmq.user,
        password: config.rabbitmq.pass,
        vhost: config.rabbitmq.vhost,
        connection: { secure: false, hostname: config.rabbitmq.host, port: config.rabbitmq.port },
      },
      logger,
      // 長時間の AI 調査ハンドラ（完了後 ack）が単一 prefetch=1 で全キューを止めるのを避ける。
      prefetchCount: config.rabbitmq.prefetch,
    });
    await this.connection.connect();

    const queueNameFormatter = new RabbitMQQueueNameFormatter("backoffice-backend");
    const failoverPublisher = new DomainEventFailoverPublisher(Promise.resolve(mongoClient));
    const eventBus = new RabbitMQEventBus({
      failoverPublisher,
      connection: this.connection,
      exchange: config.rabbitmq.exchangeName,
      queueNameFormatter,
      maxRetries: 3,
    });

    // read-model（案②）: Valkey 有効時のみ cache-aside デコレータで包む。
    // 無効時は MongoAlertRepository を素通し＝現状動作（Mongo 直読）を一切変えない。
    // demo reset は Mongo を直 delete するため、read-model の一覧キャッシュを無効化する必要がある
    // （さもないと reset 後も GET /alerts が古い一覧を返す）。store 参照を demo reset へ渡す。
    const alertReadModelStore: AlertReadModelStore | null = valkey.enabled
      ? new RedisAlertReadModelStore(valkey)
      : null;
    const alertRepository: AlertRepository = alertReadModelStore
      ? new ReadModelCachingAlertRepository(
          new MongoAlertRepository(mongoClient),
          alertReadModelStore,
        )
      : new MongoAlertRepository(mongoClient);
    const knownErrorPatternRepository = new MongoKnownErrorPatternRepository(mongoClient);

    // 完全一致は常時。ES 設定時のみ類似度（graded confidence）の SimilarPatternRule を足す。
    const rules: ClassificationRule[] = [
      new KnownPatternRule(knownErrorPatternRepository),
    ];
    const similarIncidentRepository =
      await this.buildSimilarIncidentRepository(rules);

    // 専任 Policy（APPLICATION）＋全 category 共通の完全一致フォールバック。
    // 組み立ての順序契約は buildAlertClassifier に集約（同構成を UT が検証）。
    const classifier = buildAlertClassifier({
      knownErrorPatternRepository,
      applicationRules: rules,
    });

    // read-only 証拠ゲートウェイは単一Gemini版（InfraInvestigationPort 経由の事前収集）と
    // ADK版（エージェントの狙い撃ちツール）で共有する。
    const cloudLoggingGateway = new CloudLoggingGatewayImpl();
    const cloudMonitoringGateway = new CloudMonitoringGatewayImpl();
    // apply 時に捕捉した IaC 変更イベントの保管。write（demo 注入＝edge）と read（調査＝worker）が
    // 本番では別プロセスに分かれるため、InMemory ではなく共有 Mongo を SoT にする
    // （InMemory 版だと調査側に apply が届かず terraform 証拠・確信度シグナルが常に欠落する）。
    const appliedInfraChangeStore = new MongoAppliedInfraChangeStore(mongoClient);
    // 未適用 plan（予兆の FUTURE_CHANGE シグナル）の受け皿。CI の plan ingest が record する想定で、
    // デモではフラッグシップ seed（F8・バックボーン VM 縮小）を DEMO_ENABLED 配下で投入する。
    // 引用チップ「証拠を開く」の解決先 PR（#83＝この plan を CI が本物の plan にした PR）を env で後付けする。
    const pendingInfraPlanStore = new InMemoryPendingInfraPlanStore();
    if (config.demo.enabled) {
      // flagship（backbone VM 縮小）の plan にだけ実 PR #83 を後付けする。Valkey plan-2 は
      // terraform 単独リソースを持たず本物の plan を作れないため非リンクの合成 seed のまま。
      const seededPlans = withPendingPlanEvidenceUrls(FORECAST_PENDING_PLAN_SEED, {
        [FORECAST_FLAGSHIP_PLAN_ADDRESS]: config.forecast.pendingPlanPrUrl,
      });
      for (const plan of seededPlans) {
        await pendingInfraPlanStore.record(plan);
      }
    }
    const terraformGateway = new TerraformGatewayImpl(
      appliedInfraChangeStore,
      pendingInfraPlanStore,
    );
    const githubGateway = new GitHubGatewayImpl(
      config.github.token,
      config.github.targetRepo,
      config.github.targetRef,
    );

    // 単一 LLMTextClient（stub 時は決定論）。AI調査の既定経路＋リメディ起案(planner)で共有する。
    const llmClient: LLMTextClient = config.ai.useStubInvestigation
      ? new StubLLMClient()
      : new GeminiLLMClient();

    // SSE 通知の差し替え（stretchⅠ・案1）。REDIS_URL 設定時のみ Valkey Pub/Sub 版に載せ替える。
    //  - worker: publish のみ（SSE クライアントを持たないので fan-out 購読は張らない）
    //  - edge/all: publish ＋ 購読して接続中クライアントへ fan-out
    // REDIS_URL 未設定（ローカル/テスト/all 既定）は従来の in-process notifier のまま。
    // ADK runner の進行イベント中継（E1(b)）が使うため、AIInvestigationPort より先に組む。
    const serveSse = config.role !== "worker";
    let sseNotifier: SSEAlertNotifier;
    if (valkey.enabled) {
      const redisNotifier = new RedisSSEAlertNotifier(valkey);
      if (serveSse) {
        await redisNotifier.startFanOut();
      }
      sseNotifier = redisNotifier;
    } else {
      sseNotifier = new EventEmitterSSEAlertNotifier();
    }

    // ★差し替えポイント（AIInvestigationPort）: 優先度 stub > ADK > 単一Gemini。
    //  - stub: ローカルE2E（Gemini課金・非決定性を排除）
    //  - ADK : マルチエージェント自律調査（タスク18・Vertex 必須）
    //  - 既定: 単一Gemini（LLMInvestigationAdapter）
    let aiInvestigationPort: AIInvestigationPort;
    if (config.ai.useAdk && !config.ai.useStubInvestigation) {
      const adkRunnerConfig = {
        model: config.gemini.model,
        // 相関検証（批判役）だけ軽量モデル＝D3 の wall-clock 逼迫に配慮（タスク J2）。
        verifierModel: config.ai.adkVerifierModel,
        // ロール別の静的モデル割当（D3 対策①）。推論の薄いロールを flash 化して wall-clock を削る。
        collectorModel: config.ai.adkCollectorModel,
        escalationModel: config.ai.adkEscalationModel,
        triageModel: config.ai.adkTriageModel,
        // コーディネーターの思考予算（fallback 第6原因の防御・env で運用チューニング可能）。
        coordinatorThinkingBudget: config.ai.adkCoordinatorThinkingBudget,
        // 最終JSONの清書役（ADR-26 恒久策）。グラフの外の直列ステップなのでエージェント数は
        // 増えない（8体のまま）。清書が使えなければコーディネーターの下書きへ戻るので、
        // 下の縮退リトライは撤去せず前段の防御として残す。
        finalizer: config.ai.adkFinalizerEnabled
          ? new GeminiInvestigationFinalizer({
              model: config.ai.adkFinalizerModel,
              useVertexAI: config.gemini.useVertexAI,
              project: config.gemini.project,
              location: config.gemini.location,
              apiKey: config.gemini.apiKey,
              timeoutMs: config.ai.adkFinalizerTimeoutMs,
            })
          : undefined,
        maxLlmCalls: config.ai.adkMaxLlmCalls,
        timeoutMs: config.ai.investigationTimeoutMs,
        logger,
        // 実行イベント（ツール呼び出し）を SSE "investigation-progress" へライブ中継（E1(b)）。
        progressNotifier: sseNotifier,
        cloudLoggingGateway,
        terraformGateway,
        githubGateway,
        similarIncidentRepository,
        // 他責/運用案件のエスカレーション草案（タスク35）の宛先を引く体制マスタ（read-only・seed 駆動）。
        escalationDirectory: new InMemoryEscalationDirectory(ESCALATION_DIRECTORY_SEED),
        // 修正PRの自動レビュー（タスク36）が diff/変更ファイル/CI を引く read-only ゲートウェイ。
        // 起票先（remediationRepo）の PR を見る。未設定なら null/空で review は自然に省略される。
        pullRequestReadGateway: new GitHubPullRequestReadGateway(
          config.github.token,
          config.github.remediationRepo,
        ),
      };
      // fallback 第6原因（最終JSON合成ターンの思考が出力予算を食い潰し空応答・実測はフル証拠の
      // 高推論シナリオで発生）への縮退リトライ用。思考予算だけ落とした同一グラフ＝深い熟考を捨てて
      // 最終JSONの出力トークンを確保する。
      // 恒久策（finalizer 分離＋responseSchema 強制）を上に入れた後もこれを残すのは、finalizer が
      // 前段の防御であって置き換えではないため——清書役自体が落ちた場合（Vertex 側の瞬断・
      // タイムアウト）の受け皿がここになる。ADK 調査そのものが例外で死ぬ経路も引き続きここが拾う。
      const retryThinkingBudget =
        config.ai.adkCoordinatorThinkingBudget > 0
          ? Math.min(4096, config.ai.adkCoordinatorThinkingBudget)
          : 4096;
      aiInvestigationPort = new ADKAgentInvestigationAdapter(
        new ADKInvestigationAgentRunner(adkRunnerConfig),
        undefined,
        logger,
        new ADKInvestigationAgentRunner({
          ...adkRunnerConfig,
          coordinatorThinkingBudget: retryThinkingBudget,
        }),
      );
    } else {
      // linkConfig は既定（env 由来）を使うため undefined を渡す（JS の既定引数が適用される）。
      // logger を注入し、LLM 例外／パース不能で fallback に落ちた理由を Cloud Logging に残す。
      aiInvestigationPort = new LLMInvestigationAdapter(llmClient, undefined, logger);
    }
    const infraInvestigationPort =
      this.overrides.infraInvestigationPort ??
      new DefaultInfraInvestigationAdapter(
        cloudLoggingGateway,
        terraformGateway,
        githubGateway,
        cloudMonitoringGateway,
      );
    const analyzeAlertUseCase = new AnalyzeAlertUseCase(
      alertRepository,
      classifier,
      eventBus,
      sseNotifier,
      logger,
    );
    const analyzeAlertCommandHandler = new AnalyzeAlertCommandHandler(analyzeAlertUseCase);

    const submitFeedbackUseCase = new SubmitFeedbackUseCase(
      alertRepository,
      knownErrorPatternRepository,
      similarIncidentRepository,
      logger,
    );
    const submitFeedbackCommandHandler = new SubmitFeedbackCommandHandler(submitFeedbackUseCase);

    const promotePatternUseCase = new PromotePatternUseCase(knownErrorPatternRepository, logger);
    const promotePatternCommandHandler = new PromotePatternCommandHandler(promotePatternUseCase);

    // 手動即時昇格（この Alert を回数不問で既知パターンへ結晶化）。
    const promoteAlertUseCase = new PromoteAlertUseCase(
      alertRepository,
      knownErrorPatternRepository,
      logger,
    );
    const promoteAlertCommandHandler = new PromoteAlertCommandHandler(promoteAlertUseCase);

    // オンデマンド AI 調査（既知一致は自動起動しない → 作業者要求で InvestigateAlertDomainEvent を発火）。
    const requestAlertInvestigationUseCase = new RequestAlertInvestigationUseCase(
      alertRepository,
      eventBus,
      sseNotifier,
      logger,
    );
    const requestAlertInvestigationCommandHandler =
      new RequestAlertInvestigationCommandHandler(requestAlertInvestigationUseCase);

    const investigateAlertUseCase = new InvestigateAlertUseCase(
      alertRepository,
      similarIncidentRepository,
      aiInvestigationPort,
      sseNotifier,
      logger,
      knownErrorPatternRepository,
      infraInvestigationPort,
    );
    // 人手トリガーの再調査（タスク9c）。自動調査とは別 UseCase（やり直しの独立ライフサイクル）。
    const reinvestigateAlertUseCase = new ReinvestigateAlertUseCase(
      alertRepository,
      similarIncidentRepository,
      aiInvestigationPort,
      sseNotifier,
      logger,
      infraInvestigationPort,
    );
    const reinvestigateAlertCommandHandler = new ReinvestigateAlertCommandHandler(
      reinvestigateAlertUseCase,
    );

    const getAlertReportUseCase = new GetAlertReportUseCase(alertRepository);
    const getAlertReportQueryHandler = new GetAlertReportQueryHandler(getAlertReportUseCase);

    const getAlertUseCase = new GetAlertUseCase(alertRepository, logger);
    const getAlertQueryHandler = new GetAlertQueryHandler(getAlertUseCase);

    const getKnownErrorPatternsUseCase = new GetKnownErrorPatternsUseCase(knownErrorPatternRepository);
    const getKnownErrorPatternsQueryHandler = new GetKnownErrorPatternsQueryHandler(getKnownErrorPatternsUseCase);

    const getAnalyticsUseCase = new GetAnalyticsUseCase(alertRepository);
    const getAnalyticsQueryHandler = new GetAnalyticsQueryHandler(getAnalyticsUseCase);

    // 証拠は調査時に永続化していないため、表示要求時に infraInvestigationPort で再収集する（read-only）。
    const getInfraEvidenceUseCase = new GetInfraEvidenceUseCase(
      alertRepository,
      infraInvestigationPort,
      logger,
    );
    const getInfraEvidenceQueryHandler = new GetInfraEvidenceQueryHandler(getInfraEvidenceUseCase);

    // リメディエーション（シナリオ4＝脆弱性検知の出口）。実行戦略は config.remediation.mode で差し替える:
    //   dispatch = CI(GitHub Actions)のAIエージェントへ投げ、実コード修正+UT/E2E をランナーで回す（精度はテストゲートで担保）
    //   advisory = in-process で SECURITY_REMEDIATION.md の方針PRを起票（CI/GitHub 不在でも動く既定）
    // どちらも RemediationExecutor の裏に隠れ、DraftRemediationUseCase はノータッチ。
    const remediationRepository = new MongoRemediationRepository(mongoClient);
    const remediationExecutor: RemediationExecutor =
      config.remediation.mode === "demo"
        ? // デモ/審査用：事前に1本だけ起票した本物の草案PRのURLを毎回返す（GitHub 非接触・PR増殖なし）。
          new FixedLinkDemoRemediation(config.remediation.demoPullRequestUrl)
        : config.remediation.mode === "dispatch"
        ? new GitHubActionsRemediationDispatcher(
            config.github.token,
            config.github.remediationRepo,
            config.remediation.dispatchEventType,
            config.remediation.maxAttempts,
            // advisory 経路の PR base と同じ値。dispatch では CI 側の checkout ref も兼ねる
            // （脆弱性の実体があるブランチを修正し、そこへ PR を戻す）。
            config.github.remediationBaseRef,
          )
        : new InProcessAdvisoryRemediation(
            // advisory の planner は調査と同じ llmClient を再利用（stub 時は決定論フォールバックへ落ちる）。
            new LLMRemediationPlanner(llmClient),
            // 結合テストは override で本物の GitHub HTTP 呼び出しだけを差し替える。
            this.overrides.remediationPort ??
              new GitHubPullRequestGateway(
                config.github.token,
                config.github.remediationRepo,
                config.github.remediationBaseRef,
              ),
          );
    const draftRemediationUseCase = new DraftRemediationUseCase(
      alertRepository,
      remediationExecutor,
      remediationRepository,
      sseNotifier,
      logger,
    );
    const draftRemediationCommandHandler = new DraftRemediationCommandHandler(draftRemediationUseCase);

    const getRemediationUseCase = new GetRemediationUseCase(remediationRepository);
    const getRemediationQueryHandler = new GetRemediationQueryHandler(getRemediationUseCase);

    // CI(dispatch経路)からの結果 callback（POST /ingest/remediation-result）の受け口。
    const recordRemediationResultUseCase = new RecordRemediationResultUseCase(
      remediationRepository,
      sseNotifier,
      logger,
    );

    // 上の callback が来なかった場合の終端。CI 側の on-missing-url:fail は「送る側」の防御で、
    // ジョブ自体が落ちれば何も送られない＝受ける側にも時間終端が要る。edge では回さない
    // （worker/all の1プロセスだけが走査する＝多重確定と SSE の重複 push を作らない）。
    if (config.role !== "edge") {
      const expireStaleRemediationsUseCase = new ExpireStaleRemediationsUseCase(
        remediationRepository,
        sseNotifier,
        logger,
        config.remediation.dispatchTimeoutMs,
      );
      this.remediationExpirySweep = setInterval(() => {
        void expireStaleRemediationsUseCase.run().catch(async (error: unknown) => {
          await logger.warn({
            service: "backoffice-backend",
            action: "remediation_expiry_sweep_failed",
            message: `期限切れ走査に失敗：${error instanceof Error ? error.message : String(error)}`,
          });
        });
      }, REMEDIATION_EXPIRY_SWEEP_INTERVAL_MS);
      // 走査そのものはプロセスを生かす理由にならない（テスト/CLI がぶら下がらないように）。
      this.remediationExpirySweep.unref();
    }

    // 予兆ブリーフィング（step6 F5/F6）: 全依存 read-only・write ゼロ。FORECAST_ENABLED off（既定）
    // ではルートが 404 なので配線は inert＝既存P0経路に影響しない。
    // ★継ぎ目: Handler へは ForecastSignalSource[] を渡す（Gateway を名指しさせない）。
    // stretchⅢ は EventLogPrecursorSource をこの配列に足すだけ。
    const forecastSignalSources: ForecastSignalSource[] = [
      new PullRequestSignalSource(githubGateway, logger),
      new PendingPlanSignalSource(terraformGateway, logger),
      new ScheduleSignalSource(
        // スケジュール seed は DEMO_ENABLED 配下で投入（本番 off では空＝シグナル無し）。
        new SeedScheduleSource(config.demo.enabled ? FORECAST_SCHEDULE_SEED : []),
        logger,
      ),
    ];
    const forecastMemoryRepository = new ResolvedAlertForecastMemoryRepository(
      alertRepository,
      logger,
    );
    if (config.forecast.enabled) {
      // 起動時に解決済み事例から投影（失敗しても空で縮退＝起動は止めない）。off 時はスキャン自体しない。
      // 生成時（ForecastRiskUseCase）にも再 warmUp されるため、ここは初期ログの観測点を兼ねる。
      await forecastMemoryRepository.warmUp();
    }
    // 予報は Mongo に1件ずつ追記する（role 非依存＝ edge/worker のどちらで生成しても同じ履歴を引く）。
    // InMemory 版は「生成した個体でしか読めない」ため、Cloud Run edge の再起動・多重インスタンスで
    // GET /forecast が 404 に落ち、かつ測定の標本が残らなかった。
    const riskForecastRepository = new MongoRiskForecastRepository(mongoClient);
    // ★差し替え点（ForecastPort）: 既定は単発 Gemini（ADK 非使用は意図的・GeminiForecastAdapter 参照）。
    const forecastPort =
      this.overrides.forecastPort ?? new GeminiForecastAdapter(llmClient, logger);
    const forecastRiskUseCase = new ForecastRiskUseCase(
      forecastSignalSources,
      forecastMemoryRepository,
      forecastPort,
      riskForecastRepository,
      logger,
    );
    const forecastRiskCommandHandler = new ForecastRiskCommandHandler(forecastRiskUseCase);

    const commandBus = new InMemoryCommandBus(
      new CommandHandlers([
        analyzeAlertCommandHandler,
        submitFeedbackCommandHandler,
        promotePatternCommandHandler,
        promoteAlertCommandHandler,
        requestAlertInvestigationCommandHandler,
        draftRemediationCommandHandler,
        reinvestigateAlertCommandHandler,
        forecastRiskCommandHandler,
      ]),
    );
    const queryBus = new InMemoryQueryBus(
      new QueryHandlers([
        getAlertReportQueryHandler,
        getAlertQueryHandler,
        getKnownErrorPatternsQueryHandler,
        getAnalyticsQueryHandler,
        getInfraEvidenceQueryHandler,
        getRemediationQueryHandler,
      ]),
    );

    const collectMonitoringEventUseCase = new CollectMonitoringEventUseCase(
      analyzeAlertCommandHandler,
      logger,
    );

    const subscribers = buildBackofficeSubscribers(
      collectMonitoringEventUseCase,
      investigateAlertUseCase,
    );
    // ロール分離（stretchⅠ）: edge は RabbitMQ consumer を張らない（GCE worker と購読を取り合わない）。
    // ただし exchange は宣言し publish は可能に保つ（ingest→AnalyzeAlert が InvestigateAlert を
    // worker へ流すため）。worker/all は従来どおり購読する。これにより Cloud Run edge を min-instances=0
    // にしても worker（GCE 常駐）がイベント処理を担保する。
    const consumeEvents = config.role !== "edge";
    // 切断→再接続時に exchange/queue/consumer を張り直し、切断中に failover 退避したイベントを再送する。
    // 起動時にも同じ手順を踏むので、前回プロセスが退避したまま落ちた分もここで回収できる。
    const setupEventBus = async () => {
      await this.configureEventBus(
        eventBus,
        queueNameFormatter,
        subscribers,
        consumeEvents,
      );
      const { drained } = await eventBus.drainFailover();
      if (drained > 0) {
        await logger.info({
          service: "backoffice-backend",
          action: "failover_events_drained",
          message: `failover 退避イベントを RabbitMQ へ再送：${drained}件`,
          retry_count: drained,
        });
      }
    };
    this.connection.onReestablished(setupEventBus);
    await setupEventBus();

    const ecDemoGateway =
      this.overrides.ecDemoGateway ?? new HttpEcDemoGateway(config.demo.ecBackendUrl);
    const triggerScenarioUseCase = new TriggerDemoScenarioUseCase(
      ecDemoGateway,
      config.demo.productId,
      appliedInfraChangeStore,
      collectMonitoringEventUseCase,
      config.demo.infraApplyPrUrl,
    );
    const demoResetUseCase = new DemoResetUseCase(
      new MongoDemoDataAdapter(mongoClient, alertReadModelStore),
      knownErrorPatternRepository,
      similarIncidentRepository,
      alertRepository,
    );

    this.server = new Server(config.port);
    // ロール分離（stretchⅠ・タスク19）: worker は HTTP のクエリ/SSE/ingest を提供せず、
    // RabbitMQ consume ＋ read-model projection（alertRepository.save 経由＝タスク18 のデコレータ）に
    // 専念する。`/health`（server.ts で常時登録）だけ生かして Cloud Run/GCE の healthcheck に応える。
    // edge/all は従来どおり全ルートを登録する（edge=公開 HTTP・all=単一プロセス）。
    if (config.role !== "worker") {
      registerRoutes(
        this.server.router,
        commandBus,
        queryBus,
        sseNotifier,
        {
          ecDemoGateway,
          triggerScenarioUseCase,
          demoResetUseCase,
        },
        {
          // Cloud Monitoring 等の検知ソースからの ingest（EC イベントと同じ観測パイプラインに合流）。
          collectMonitoringEventUseCase,
          // CI(AIリメディジョブ)からの結果 callback。
          recordRemediationResultUseCase,
          // CI(terraform plan ジョブ)からの未適用 plan 投入（予兆 FUTURE_CHANGE・seed と同じ record 口）。
          pendingInfraPlanStore,
          ingestToken: config.ingestToken,
        },
        {
          // 予兆ブリーフィング（FORECAST_ENABLED off では guard が 404 を返す）。
          riskForecastRepository,
          horizon: config.forecast.horizon,
        },
      );
    }
  }

  async start(): Promise<void> {
    await this.build();
    await this.server.listen();
  }

  // supertest 用：ポートを listen せず Express アプリだけ取り出す（build() 後に呼ぶ）。
  get httpApp(): Application {
    return this.server.express;
  }

  async stop(): Promise<void> {
    if (this.remediationExpirySweep) {
      clearInterval(this.remediationExpirySweep);
      this.remediationExpirySweep = undefined;
    }
    await this.connection?.close();
    await this.valkey?.close();
    await this.server?.stop();
  }

  // ES 設定時は Elasticsearch を SimilarIncident の永続＋類似検索に使い、SimilarPatternRule を分類に追加する。
  // 未設定時も InMemory の字句類似（Jaccard [0,1]）で SimilarPatternRule を載せ、graded confidence
  // （類似・準既知）をデモ/ローカルでも成立させる。コーパスが空なら search は空→Rule 棄権なので
  // 従来挙動（完全一致のみ）と等価で E2E も無傷（E2E は解決済み事例を index しない）。
  private async buildSimilarIncidentRepository(
    rules: ClassificationRule[],
  ): Promise<SimilarIncidentRepository> {
    if (!config.elasticsearch.url) {
      const inMemory = new InMemorySimilarIncidentRepository();
      await inMemory.warmUp([]);
      // InMemory の search は有界な Jaccard [0,1] を返すので scoreCeiling は既定(1)でよい。
      rules.push(new SimilarPatternRule(inMemory));
      return inMemory;
    }

    const esClient = ElasticClientFactory.createClient("backoffice-similar-incidents", {
      url: config.elasticsearch.url,
      indexName: config.elasticsearch.similarIncidentsIndex,
      indexConfig: SIMILAR_INCIDENTS_INDEX_CONFIG,
    });
    const esRepository = new ElasticSimilarIncidentRepository(
      esClient,
      config.elasticsearch.similarIncidentsIndex,
    );
    // search は有界な字句類似度 [0,1] を返す（BM25 は候補取得のみ）。minConfidence 未満は棄権して AI 調査へ。
    rules.push(
      new SimilarPatternRule(
        esRepository,
        config.elasticsearch.similarMinConfidence,
        config.elasticsearch.similarScoreCeiling,
      ),
    );
    return esRepository;
  }

  private async configureEventBus(
    eventBus: RabbitMQEventBus,
    queueNameFormatter: RabbitMQQueueNameFormatter,
    subscribers: DomainEventSubscribers,
    consume: boolean,
  ): Promise<void> {
    const configurer = new RabbitMQConfigurer(this.connection, queueNameFormatter, config.rabbitmq.retryTtl);
    // edge（consume=false）は exchange だけ宣言して publish 可能にし、queue/consumer は張らない。
    await configurer.configure({
      exchange: config.rabbitmq.exchangeName,
      subscribers: consume ? subscribers.items : [],
    });
    if (consume) {
      await eventBus.addSubscribers(subscribers);
    }
  }
}
