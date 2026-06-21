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
import { MongoAlertRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { MongoKnownErrorPatternRepository } from "../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoKnownErrorPatternRepository.js";
import { InvestigateAlertUseCase } from "../../../../Contexts/Monitoring/AIInvestigation/application/InvestigateAlert/InvestigateAlertUseCase.js";
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
    const similarIncidentRepository = new InMemorySimilarIncidentRepository();
    await similarIncidentRepository.warmUp([]);

    const classifier = new PolicyBasedAlertClassifier([
      new ApplicationClassificationPolicy(
        [new KnownPatternRule(knownErrorPatternRepository)],
        new ClassificationRuleSorter(),
      ),
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

    const commandBus = new InMemoryCommandBus(
      new CommandHandlers([
        analyzeAlertCommandHandler,
        submitFeedbackCommandHandler,
        promotePatternCommandHandler,
      ]),
    );
    const queryBus = new InMemoryQueryBus(
      new QueryHandlers([
        getAlertReportQueryHandler,
        getAlertQueryHandler,
        getKnownErrorPatternsQueryHandler,
        getAnalyticsQueryHandler,
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
    );

    this.server = new Server(config.port);
    registerRoutes(this.server.router, commandBus, queryBus, sseNotifier, {
      ecDemoGateway,
      triggerScenarioUseCase,
      demoResetUseCase,
    });
    await this.server.listen();
  }

  async stop(): Promise<void> {
    await this.connection?.close();
    await this.server?.stop();
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
