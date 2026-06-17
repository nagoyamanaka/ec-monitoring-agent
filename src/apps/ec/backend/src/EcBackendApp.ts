import { CompensateOrderUseCase } from "../../../../Contexts/EC/Orders/application/CompensateOrder/CompensateOrderUseCase.js";
import { GetOrderQueryHandler } from "../../../../Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.js";
import { GetOrderUseCase } from "../../../../Contexts/EC/Orders/application/GetOrder/GetOrderUseCase.js";
import { PlaceOrderCommandHandler } from "../../../../Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommandHandler.js";
import { PlaceOrderUseCase } from "../../../../Contexts/EC/Orders/application/PlaceOrder/PlaceOrderUseCase.js";
import { MongoOrderRepository } from "../../../../Contexts/EC/Orders/infrastructure/persistence/MongoOrderRepository.js";
import { PaymentMockOrderGateway } from "../../../../Contexts/EC/Orders/infrastructure/PaymentMockOrderGateway.js";
import { ReserveInventoryUseCase } from "../../../../Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryUseCase.js";
import { MongoInventoryRepository } from "../../../../Contexts/EC/Inventory/infrastructure/persistence/MongoInventoryRepository.js";
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
import { buildEcSubscribers } from "./subscribers/EcSubscribers.js";
import { config } from "./config.js";

export class EcBackendApp {
  private server!: Server;
  private connection!: RabbitMqConnection;

  async start(): Promise<void> {
    const mongoClient = await MongoClientFactory.createClient("ec", { url: config.mongoUrl });
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

    const queueNameFormatter = new RabbitMQQueueNameFormatter("ec-backend");
    const failoverPublisher = new DomainEventFailoverPublisher(Promise.resolve(mongoClient));
    const eventBus = new RabbitMQEventBus({
      failoverPublisher,
      connection: this.connection,
      exchange: config.rabbitmq.exchangeName,
      queueNameFormatter,
      maxRetries: 3,
    });

    const orderRepository = new MongoOrderRepository(mongoClient);
    const inventoryRepository = new MongoInventoryRepository(mongoClient);
    const paymentGateway = new PaymentMockOrderGateway();

    const placeOrderUseCase = new PlaceOrderUseCase(orderRepository, eventBus, paymentGateway, logger);
    const getOrderUseCase = new GetOrderUseCase(orderRepository, logger);
    const reserveInventoryUseCase = new ReserveInventoryUseCase(inventoryRepository, eventBus, logger);
    const compensateOrderUseCase = new CompensateOrderUseCase(orderRepository, logger);

    const commandBus = new InMemoryCommandBus(
      new CommandHandlers([new PlaceOrderCommandHandler(placeOrderUseCase)]),
    );
    const queryBus = new InMemoryQueryBus(
      new QueryHandlers([new GetOrderQueryHandler(getOrderUseCase)]),
    );

    await this.configureEventBus(
      eventBus,
      queueNameFormatter,
      buildEcSubscribers(reserveInventoryUseCase, compensateOrderUseCase),
    );

    this.server = new Server(config.port);
    registerRoutes(this.server.router, commandBus, queryBus, paymentGateway);
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
