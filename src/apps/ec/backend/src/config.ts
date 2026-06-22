export const config = {
  port: parseInt(process.env.PORT ?? "3000"),
  mongoUrl: process.env.MONGO_URL ?? "mongodb://localhost:27017/ec",
  rabbitmq: {
    host: process.env.RABBITMQ_HOST ?? "localhost",
    port: parseInt(process.env.RABBITMQ_PORT ?? "5672"),
    user: process.env.RABBITMQ_USER ?? "guest",
    pass: process.env.RABBITMQ_PASS ?? "guest",
    vhost: process.env.RABBITMQ_VHOST ?? "/",
    retryTtl: parseInt(process.env.RABBITMQ_RETRY_TTL ?? "5000"),
    exchangeName: process.env.EXCHANGE_NAME ?? "ec-domain-events",
  },
  demo: {
    paymentMode: process.env.PAYMENT_MODE ?? "success",
    controlsEnabled: process.env.DEMO_CONTROLS_ENABLED === "true",
  },
} as const;
