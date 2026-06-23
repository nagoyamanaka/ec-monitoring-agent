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
import { SubmitFeedbackCommandHandler } from "../../../../Contexts/Monitoring/AlertAnalysis/application/SubmitFeedback/SubmitFeedbackCommandHandler.js";
import { SubmitFeedbackUseCase } from "../../../../Contexts/Monitoring/AlertAnalysis/application/SubmitFeedback/SubmitFeedbackUseCase.js";
import { ApplicationClassificationPolicy } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/policies/ApplicationClassificationPolicy.js";
import { PolicyBasedAlertClassifier } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/PolicyBasedAlertClassifier.js";
import { ClassificationRuleSorter } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/ClassificationRuleSorter.js";
import { KnownPatternRule } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/rules/KnownPatternRule.js";
import { SimilarPatternRule } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/rules/SimilarPatternRule.js";
import { ClassificationRule } from "../../../../Contexts/Monitoring/AlertAnalysis/domain/classification/ClassificationRule.js";
import { MongoAlertRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { MongoKnownErrorPatternRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoKnownErrorPatternRepository.js";
import { InvestigateAlertUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/InvestigateAlert/InvestigateAlertUseCase.js";
import { GetInfraEvidenceUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/GetInfraEvidenceUseCase.js";
import { GetInfraEvidenceQueryHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/GetInfraEvidenceQueryHandler.js";
import { GetInvestigationStatusUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetInvestigationStatus/GetInvestigationStatusUseCase.js";
import { GetInvestigationStatusQueryHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetInvestigationStatus/GetInvestigationStatusQueryHandler.js";
import { DraftRemediationUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/DraftRemediation/DraftRemediationUseCase.js";
import { DraftRemediationCommandHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/DraftRemediation/DraftRemediationCommandHandler.js";
import { GetRemediationUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetRemediation/GetRemediationUseCase.js";
import { GetRemediationQueryHandler } from "../../../../Contexts/Monitoring/AIInvestigation/application/GetRemediation/GetRemediationQueryHandler.js";
import { RecordRemediationResultUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/RecordRemediationResult/RecordRemediationResultUseCase.js";
import { RemediationExecutor } from "../../../../Contexts/Monitoring/AIInvestigation/domain/remediation/RemediationExecutor.js";
import { LLMRemediationPlanner } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/LLMRemediationPlanner.js";
import { GitHubPullRequestGateway } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/GitHubPullRequestGateway.js";
import { InProcessAdvisoryRemediation } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/InProcessAdvisoryRemediation.js";
import { GitHubActionsRemediationDispatcher } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/GitHubActionsRemediationDispatcher.js";
import { MongoRemediationRepository } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/remediation/MongoRemediationRepository.js";
import { LLMInvestigationAdapter } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/LLMInvestigationAdapter.js";
import { GeminiLLMClient } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/GeminiLLMClient.js";
import { StubLLMClient } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/aiinvestigation/StubLLMClient.js";
import { LLMTextClient } from "../../../../Contexts/Monitoring/AIInvestigation/domain/LLMTextClient.js";
import { DefaultInfraInvestigationAdapter } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/DefaultInfraInvestigationAdapter.js";
import { CloudLoggingGatewayImpl } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/CloudLoggingGatewayImpl.js";
import { TerraformGatewayImpl } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/TerraformGatewayImpl.js";
import { GitHubGatewayImpl } from "../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/GitHubGatewayImpl.js";
import { EventEmitterSSEAlertNotifier } from "../../../../Contexts/Monitoring/AlertNotification/infrastructure/EventEmitterSSEAlertNotifier.js";
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
import { Server } from "./server.js";
import { registerRoutes } from "./routes/index.js";
import { buildBackofficeSubscribers } from "./subscribers/BackofficeSubscribers.js";
import { HttpEcDemoGateway } from "./demo/HttpEcDemoGateway.js";
import { TriggerDemoScenarioUseCase } from "./demo/TriggerDemoScenarioUseCase.js";
import { MongoDemoDataAdapter } from "./demo/MongoDemoDataAdapter.js";
import { DemoResetUseCase } from "./demo/DemoResetUseCase.js";
import { config } from "./config.js";

export class BackofficeApp {
  private server!: Server;
  private connection!: RabbitMqConnection;

  async start(): Promise<void> {
    const mongoClient = await MongoClientFactory.createClient("backoffice", { url: config.mongoUrl });
    const logger = new GcpCloudLoggingLogger();

    this.connection = new RabbitMqConnection({
      connectionSettings: {
        username: config.rabbitmq.user,
        password: config.rabbitmq.pass,
        vhost: config.rabbitmq.vhost,
        connection: { secure: false, hostname: config.rabbitmq.host, port: config.rabbitmq.port },
      },
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

    const alertRepository = new MongoAlertRepository(mongoClient);
    const knownErrorPatternRepository = new MongoKnownErrorPatternRepository(mongoClient);

    // 完全一致は常時。ES 設定時のみ類似度（graded confidence）の SimilarPatternRule を足す。
    const rules: ClassificationRule[] = [
      new KnownPatternRule(knownErrorPatternRepository),
    ];
    const similarIncidentRepository =
      await this.buildSimilarIncidentRepository(rules);

    const classifier = new PolicyBasedAlertClassifier([
      new ApplicationClassificationPolicy(rules, new ClassificationRuleSorter()),
    ]);

    // ★差し替えポイント: ローカルE2E では Stub に切替え（Gemini課金・非決定性を排除）
    const llmClient: LLMTextClient = config.ai.useStubInvestigation
      ? new StubLLMClient()
      : new GeminiLLMClient();
    const aiInvestigationPort = new LLMInvestigationAdapter(llmClient);
    const infraInvestigationPort = new DefaultInfraInvestigationAdapter(
      new CloudLoggingGatewayImpl(),
      new TerraformGatewayImpl(),
      new GitHubGatewayImpl(config.github.token, config.github.targetRepo),
    );
    const sseNotifier = new EventEmitterSSEAlertNotifier();

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

    const investigateAlertUseCase = new InvestigateAlertUseCase(
      alertRepository,
      similarIncidentRepository,
      aiInvestigationPort,
      sseNotifier,
      logger,
      infraInvestigationPort,
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

    const getInvestigationStatusUseCase = new GetInvestigationStatusUseCase(alertRepository, logger);
    const getInvestigationStatusQueryHandler = new GetInvestigationStatusQueryHandler(
      getInvestigationStatusUseCase,
    );

    // リメディエーション（シナリオ5の出口）。実行戦略は config.remediation.mode で差し替える:
    //   dispatch = CI(GitHub Actions)のAIエージェントへ投げ、実コード修正+UT/E2E をランナーで回す（精度はテストゲートで担保）
    //   advisory = in-process で SECURITY_REMEDIATION.md の方針PRを起票（CI/GitHub 不在でも動く既定）
    // どちらも RemediationExecutor の裏に隠れ、DraftRemediationUseCase はノータッチ。
    const remediationRepository = new MongoRemediationRepository(mongoClient);
    const remediationExecutor: RemediationExecutor =
      config.remediation.mode === "dispatch"
        ? new GitHubActionsRemediationDispatcher(
            config.github.token,
            config.github.remediationRepo,
            config.remediation.dispatchEventType,
            config.remediation.maxAttempts,
          )
        : new InProcessAdvisoryRemediation(
            // advisory の planner は調査と同じ llmClient を再利用（stub 時は決定論フォールバックへ落ちる）。
            new LLMRemediationPlanner(llmClient),
            new GitHubPullRequestGateway(config.github.token, config.github.remediationRepo),
          );
    const draftRemediationUseCase = new DraftRemediationUseCase(
      alertRepository,
      remediationExecutor,
      remediationRepository,
      logger,
    );
    const draftRemediationCommandHandler = new DraftRemediationCommandHandler(draftRemediationUseCase);

    const getRemediationUseCase = new GetRemediationUseCase(remediationRepository);
    const getRemediationQueryHandler = new GetRemediationQueryHandler(getRemediationUseCase);

    // CI(dispatch経路)からの結果 callback（POST /ingest/remediation-result）の受け口。
    const recordRemediationResultUseCase = new RecordRemediationResultUseCase(
      remediationRepository,
      logger,
    );

    const commandBus = new InMemoryCommandBus(
      new CommandHandlers([
        analyzeAlertCommandHandler,
        submitFeedbackCommandHandler,
        promotePatternCommandHandler,
        draftRemediationCommandHandler,
      ]),
    );
    const queryBus = new InMemoryQueryBus(
      new QueryHandlers([
        getAlertReportQueryHandler,
        getAlertQueryHandler,
        getKnownErrorPatternsQueryHandler,
        getAnalyticsQueryHandler,
        getInfraEvidenceQueryHandler,
        getInvestigationStatusQueryHandler,
        getRemediationQueryHandler,
      ]),
    );

    const collectMonitoringEventUseCase = new CollectMonitoringEventUseCase(
      analyzeAlertCommandHandler,
      logger,
    );

    await this.configureEventBus(
      eventBus,
      queueNameFormatter,
      buildBackofficeSubscribers(collectMonitoringEventUseCase, investigateAlertUseCase),
    );

    const ecDemoGateway = new HttpEcDemoGateway(config.demo.ecBackendUrl);
    const triggerScenarioUseCase = new TriggerDemoScenarioUseCase(ecDemoGateway, config.demo.productId);
    const demoResetUseCase = new DemoResetUseCase(
      new MongoDemoDataAdapter(mongoClient),
      knownErrorPatternRepository,
      alertRepository,
    );

    this.server = new Server(config.port);
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
        ingestToken: config.ingestToken,
      },
    );
    await this.server.listen();
  }

  async stop(): Promise<void> {
    await this.connection?.close();
    await this.server?.stop();
  }

  // ES 設定時は Elasticsearch を SimilarIncident の永続＋類似検索に使い、SimilarPatternRule を分類に追加する。
  // 未設定時は InMemory にフォールバック（従来挙動＝完全一致のみ・分類は変えない）。
  private async buildSimilarIncidentRepository(
    rules: ClassificationRule[],
  ): Promise<SimilarIncidentRepository> {
    if (!config.elasticsearch.url) {
      const inMemory = new InMemorySimilarIncidentRepository();
      await inMemory.warmUp([]);
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
    // BM25 の生スコアを scoreCeiling で [0,1] 正規化、minConfidence 未満は棄権（いずれも env 調整可）。
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
  ): Promise<void> {
    const configurer = new RabbitMQConfigurer(this.connection, queueNameFormatter, config.rabbitmq.retryTtl);
    await configurer.configure({ exchange: config.rabbitmq.exchangeName, subscribers: subscribers.items });
    await eventBus.addSubscribers(subscribers);
  }
}
